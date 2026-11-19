# 异病档案 · 异病侦探 Live2D

面向 GitHub Pages 的纯静态展示站，包含 24 个模型、333 个动作及原始物理设置。左侧按角色整理主模型、旧版与差分，中间为 Live2D 舞台，右侧为中文动作列表。运行时不依赖外部 CDN。

## 本地预览

安装 Node.js 24，然后双击 `start-preview.cmd`。或在此目录运行：

```sh
npm start
```

访问 <http://127.0.0.1:4173/live2d-viewer/>。不能直接双击 index.html，浏览器需要通过 HTTP 读取模型。

拖动移动角色、滚轮缩放、双击复位。空格暂停或播放，R 重新播放。支持播放速度、循环、视线跟随、物理开关、背景切换、透明 PNG 截图与模型/动作分享链接。手机端角色列表横向滑动，动作列表位于舞台下方。

## 部署到 GitHub Pages

1. 在 GitHub 创建公开仓库，例如 `psycho-sleuth-live2d`。
2. 将**本文件夹内的内容**作为仓库根目录上传，确保仓库根目录直接包含 `index.html`、`assets/`、`src/`、`vendor/`、`package.json` 和 `.github/`。不要上传整个解包项目，也不要在仓库外层再套一层 live2d-viewer。
3. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 推送到 `main` 分支后，`Deploy Live2D viewer to Pages` 自动校验和发布；也可在 Actions 中选择该工作流并点击 Run workflow。
5. 在 Pages 或工作流 Deployment 中查看地址，一般为 `https://用户名.github.io/仓库名/`。所有资源使用相对路径，仓库可以任意命名。

推荐使用 Git 或 GitHub Desktop 上传。GitHub 网页上传有单文件大小限制，最大的模型约 89 MiB，应使用 Git 上传。模型目前无需 Git LFS；不要启用 LFS 后直接依赖指针文件作为 Pages 资源。

首次上传命令（在此文件夹运行，将 URL 替换为你的仓库）：

```sh
git init
git add .
git commit -m "Add Live2D character viewer"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库.git
git push -u origin main
```

不要把 `dist/`、Node 缓存或原游戏目录提交到仓库。发布工作流会自动生成 `dist/`。

官方部署流程：<https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

## 检查与打包

无需 npm install，本项目没有 Node 运行依赖。

```sh
npm test
npm run validate
npm run build
```

`dist/` 为可单独托管的纯静态网站。开发源码和 CI 文件不包含在发布页面中。

资源已复制到 `assets/models/`，可以把本文件夹独立移动。原提取目录保持不变。若原项目新增资源，可从当前目录运行 `python scripts/prepare_assets.py` 重新生成；它读取同级 `../角色Live2D_可用/`。校验使用 `--check`，不需要原提取目录。

## 资源说明

- 兼容分组里重复引用的动作仅展示一次，共 333 个原始动作。
- 没有独立的 exp3 表情资源；喜、哀、微怒、思考等在动作列表里。
- 一些原始动作只有约 1 秒，主要改变表情或参数，动态幅度较小。
- 幼年爱丽丝的部分变身轨道使用成年模型的参数，应在成年模型上预览。
- 萊娜差分 1 的 moc3 含大量零填充，约 89 MiB，首次加载明显较慢。模型按需加载，网站不会一次下载全部角色。
- 保存截图仅包含角色，导出透明 PNG；舞台背景、装饰和按钮不写入图片。

## 第三方组件与版权

模型、贴图、动作与相关美术版权归《异病侦探》原权利人所有。本站为非官方展示，请支持原作。

渲染库使用 PixiJS 6.5.10 与 pixi-live2d-display 0.4.0（MIT，许可证保留在 vendor）。Cubism Core 来自 Live2D 官方 Web Core 地址，文件头保留官方许可链接；其授权独立于 MIT，详见 `THIRD_PARTY.md`。
