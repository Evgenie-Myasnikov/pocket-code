import {test,expect} from '@playwright/test';
import {desktop} from './desktop-fixture';

const shader='// Synthetic shader\ncbuffer Frame : register(b0) { float4x4 view; };\nfloat4 main(float4 position : SV_Position) : SV_Target\n{\n    return float4(1.0, 0.5, 0.25, 1.0);\n}\n';

test('code in answers and in the side panel is coloured by the VS Code grammars, HLSL and GLSL included',async({page})=>{
 await page.addInitScript(shader=>{
   (window as any).testFileTexts={'lighting.hlsl':shader};(window as any).testFileSizes={'shaders/lighting.hlsl':7372};
   (window as any).branchMessages=[
     {id:'ask',role:'user',blocks:[{type:'text',text:'Write the shaders.'}]},
     {id:'edit',role:'assistant',blocks:[{type:'tool_use',id:'change',name:'File changes',input:{status:'completed',changes:[{path:'shaders/lighting.hlsl',kind:'add',diff:'float4 main() : SV_Target { return 1; }'}]}}]},
     {id:'done',role:'assistant',blocks:[{type:'text',text:'The vertex stage:\n\n```glsl\n#version 450\nlayout(location = 0) in vec3 position;\nvoid main() { gl_Position = vec4(position, 1.0); }\n```'}]}];
 },shader);
 await desktop(page);
 await page.getByRole('button',{name:/claude · Interface review/}).click();
 // a fenced GLSL block in the answer
 const glsl=page.locator('.markdown pre code.language-glsl').first();await expect(glsl).toBeVisible();
 await expect(glsl.locator('.code-line span[style*="--shiki-dark"]').first()).toBeVisible({timeout:10000});
 const colours=await glsl.locator('.code-line span').evaluateAll(spans=>new Set(spans.map(span=>getComputedStyle(span).color)).size);
 expect(colours).toBeGreaterThan(2);
 await expect(glsl).toContainText('gl_Position = vec4(position, 1.0);');
 // an HLSL file from the turn result, in the side panel
 const card=page.getByRole('region',{name:'Turn result'});await card.getByRole('button',{name:/Files: 1/}).click();
 // the row shows the file's size from the PC, as in Strata
 await expect(card.locator('.turn-result-size')).toHaveText('7.2 KB');
 await card.getByRole('button',{name:'shaders/lighting.hlsl'}).click();
 const panel=page.locator('.chat-side-panel');await expect(panel.getByRole('tab',{name:'lighting.hlsl'})).toBeVisible();
 // a file from the turn result opens on what changed in it; the whole file is the other view
 await panel.getByRole('button',{name:'File',exact:true}).click();
 const code=panel.locator('.file-preview-body pre');await expect(code.locator('.code-line').first()).toBeVisible({timeout:10000});
 await expect(code).toContainText('float4 main(float4 position : SV_Position) : SV_Target');
 const keyword=await code.locator('.code-line span',{hasText:'cbuffer'}).first().evaluate(span=>getComputedStyle(span).color);
 const plain=await code.locator('.code-line span',{hasText:'Frame'}).first().evaluate(span=>getComputedStyle(span).color);
 expect(keyword).not.toBe(plain);
 await page.screenshot({path:'.local/code-highlight.png'});
});
