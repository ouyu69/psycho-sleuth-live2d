"""Copy only referenced Live2D files, and build a portable static catalog."""
import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / '角色Live2D_可用'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def validate(root, catalog):
    count = 0
    for model in catalog['models']:
        entry = root / model['url']
        refs = read(entry)['FileReferences']
        paths = [refs['Moc'], *refs['Textures']]
        paths += [refs[key] for key in ('Physics', 'Pose', 'DisplayInfo') if key in refs]
        paths += [motion['File'] for group in refs.get('Motions', {}).values() for motion in group]
        paths += [exp['File'] for exp in refs.get('Expressions', [])]
        for relative in paths:
            path = (entry.parent / relative).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file():
                raise ValueError(f'Missing or unsafe reference: {entry}: {relative}')
            if path.suffix == '.json':
                read(path)
        count += len(model['motions'])
    assert len(catalog['models']) == 24
    assert count == 333, count
    print(f'Validated {len(catalog["models"])} models, {count} unique motions and every referenced asset.')

def build():
    models = []
    order = ['大愛麗絲', '小愛麗絲', '亥珀', '灰妲', '艾', '菲絲', '守', '伴', '柯塔', '萊娜_legacy251211', '萊爾_legacy251211', '代理教主', '真教主', '解', '雷']
    entries = sorted(SOURCE.glob('*/*.model3.json'), key=lambda p: (order.index(p.parent.name) if p.parent.name in order else 100, p.parent.name))
    for entry in entries:
        name = entry.parent.name
        data = read(entry)
        refs = data['FileReferences']
        motions, seen = [], set()
        for group, definitions in refs.get('Motions', {}).items():
            for index, motion in enumerate(definitions):
                file = motion['File']
                if file in seen:
                    continue
                seen.add(file)
                meta = read(entry.parent / file)['Meta']
                label = Path(file).name.removesuffix('.motion3.json')
                motions.append(dict(id=label, name=label, file=file, group=group, index=index,
                                    duration=meta['Duration'], fps=meta.get('Fps', 30), loop=meta.get('Loop', False)))
        default = next((label for label in ['一般', '原樣', '正常', '待機'] if any(m['id'] == label for m in motions)), motions[0]['id'])
        base, _, variant = name.partition('_')
        if name in ('大愛麗絲', '小愛麗絲'):
            character, variant = '愛麗絲', '成年' if name.startswith('大') else '幼年'
        elif name == '萊爾成神':
            character, variant = '萊爾', '成神'
        elif name == '教主_260202':
            character, variant = '代理教主', '舊版 · 260202'
        else:
            character = '絆' if base == '伴' else base
            variant = variant.replace('立繪差分', '差分 ').replace('legacy', '舊版 · ') or '主模型'
        destination = ROOT / 'assets' / 'models' / name
        destination.mkdir(parents=True, exist_ok=True)
        paths = [entry.name, refs['Moc'], *refs['Textures'], *seen]
        paths += [refs[key] for key in ('Physics', 'Pose', 'DisplayInfo') if key in refs]
        paths += [exp['File'] for exp in refs.get('Expressions', [])]
        for relative in paths:
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(entry.parent / relative, target)
        models.append(dict(id=name, name=name, character=character, variant=variant,
                           url=(destination / entry.name).relative_to(ROOT).as_posix(),
                           bytes=sum((entry.parent / p).stat().st_size for p in set(paths)),
                           physics=bool(refs.get('Physics')), motions=motions, defaultMotion=default))
    catalog = dict(title='异病侦探 · 异病档案', models=models)
    (ROOT / 'assets' / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    validate(ROOT, catalog)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        validate(ROOT, read(ROOT / 'assets' / 'catalog.json'))
    else:
        build()
