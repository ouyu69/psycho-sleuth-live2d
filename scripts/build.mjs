import {cpSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=resolve(root,'dist');
// The deletion target is a fixed child of this website, never supplied by input.
rmSync(destination,{recursive:true,force:true});
mkdirSync(destination,{recursive:true});
for(const name of ['index.html','favicon.svg','.nojekyll','src','assets','vendor']){
  cpSync(resolve(root,name),resolve(destination,name),{recursive:true});
}
console.log('Static site prepared in dist/ (HTML, app, libraries and model assets only).');
