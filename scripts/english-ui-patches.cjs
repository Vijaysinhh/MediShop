// Read-only codemod: emits patches for English UI branches, leaves stored data intact.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const write = process.argv.includes('--write');
const excluded = new Set(process.argv.slice(2).filter(p=>p!=='--write').map(p => p.replaceAll('\\','/')));
const files = [];
function walk(dir) { for (const file of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,file.name); if(file.isDirectory())walk(p);else if(/\.tsx?$/.test(p))files.push(p); } }
walk('app');walk('components');
files.push('lib/pdf-utils.ts','lib/pdf-fonts.ts','lib/premium-pdf.tsx','lib/simple-pdf.ts');
const patches=[];
for(const filename of files){
  if(excluded.has(filename.replaceAll('\\','/')))continue;
  const source=fs.readFileSync(filename,'utf8');
  const ast=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const hasMrFlag=/const mr\s*=\s*language\s*===\s*["']mr["']/.test(source);
  const edits=[];
  function value(n){
    if(ts.isParenthesizedExpression(n))return value(n.expression);
    if(ts.isStringLiteral(n))return n.text;
    if(ts.isIdentifier(n)&&['language','lang'].includes(n.text))return 'en';
    if(ts.isIdentifier(n)&&n.text==='mr'&&hasMrFlag)return false;
    if(ts.isBinaryExpression(n)){
      const a=value(n.left),b=value(n.right);if(a===undefined||b===undefined)return;
      if([ts.SyntaxKind.EqualsEqualsEqualsToken,ts.SyntaxKind.EqualsEqualsToken].includes(n.operatorToken.kind))return a===b;
      if([ts.SyntaxKind.ExclamationEqualsEqualsToken,ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind))return a!==b;
    }
  }
  function visit(n){
    if(ts.isConditionalExpression(n)){
      const v=value(n.condition);if(typeof v==='boolean'){const branch=v?n.whenTrue:n.whenFalse;edits.push([n.getStart(ast),n.end,'('+branch.getText(ast)+')']);return;}
    }
    if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken){const v=value(n.left);if(typeof v==='boolean'){edits.push([n.getStart(ast),n.end,v?'('+n.right.getText(ast)+')':'false']);return;}}
    if(ts.isIfStatement(n)){
      const v=value(n.expression);if(typeof v==='boolean'){edits.push([n.getStart(ast),n.end,v?n.thenStatement.getText(ast):n.elseStatement?.getText(ast)||'']);return;}
    }
    if(ts.isElementAccessExpression(n)&&ts.isIdentifier(n.argumentExpression)&&n.argumentExpression.text==='language'&&n.expression.getText(ast)==='copy'){
      edits.push([n.getStart(ast),n.end,'copy.en']);return;
    }
    ts.forEachChild(n,visit);
  }
  visit(ast);if(!edits.length)continue;
  let result=source;for(const [start,end,text] of edits.sort((a,b)=>b[0]-a[0]))result=result.slice(0,start)+text+result.slice(end);
  if(write) {fs.writeFileSync(filename,result); patches.push(filename);}
  else patches.push({filename:path.resolve(filename),source,result});
}
process.stdout.write(JSON.stringify(patches));
