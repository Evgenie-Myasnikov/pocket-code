import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {whiteboardChart,whiteboardSchema,type WhiteboardChart} from '../src/whiteboard-model.js';
import {niceScale,chartLayout,change,formatValue,parseTable} from '../src/whiteboard-chart-layout.js';

const frameTime:WhiteboardChart={type:'bar',categories:['P50','P95','P99'],series:[{name:'Before',values:[9.8,16.2,24.5]},{name:'After',values:[6.1,9.4,13]}],unit:'ms',lowerIsBetter:true,reference:{value:16.7,label:'60 fps'}};

test('chart data is validated: one value per category, at most eight series, stacked values are not negative',()=>{
 assert.ok(whiteboardChart.safeParse(frameTime).success);
 assert.equal(whiteboardChart.safeParse({...frameTime,series:[{name:'Before',values:[1,2]}]}).success,false);
 assert.equal(whiteboardChart.safeParse({...frameTime,series:Array.from({length:9},(_,i)=>({name:'S'+i,values:[1,2,3]}))}).success,false);
 assert.equal(whiteboardChart.safeParse({...frameTime,stacked:true,series:[{name:'Pass',values:[1,-2,3]}]}).success,false);
 assert.equal(whiteboardChart.safeParse({...frameTime,type:'pie'}).success,false);
 assert.ok(whiteboardChart.safeParse({...frameTime,series:[{name:'Before',values:[1,null,3]}]}).success);
 const item={id:randomUUID(),kind:'chart',text:'Frame time',x:0,y:0,width:560,height:360,color:'sand',chart:frameTime};
 assert.ok(whiteboardSchema.safeParse({version:1,items:[item],links:[]}).success);
 // A chart needs its data, and only a chart carries data.
 assert.equal(whiteboardSchema.safeParse({version:1,items:[{...item,chart:undefined}],links:[]}).success,false);
 assert.equal(whiteboardSchema.safeParse({version:1,items:[{...item,kind:'sticky'}],links:[]}).success,false);
});

test('axis steps are clean numbers and always include zero and the reference line',()=>{
 assert.deepEqual(niceScale(0,24.5).values,[0,10,20,30]);
 assert.deepEqual(niceScale(0,0.9).values,[0,0.5,1]);assert.deepEqual(niceScale(0,7).values,[0,2,4,6,8]);
 assert.deepEqual(niceScale(-12,30).values,[-20,0,20,40]);
 assert.deepEqual(niceScale(0,0).values,[0,0.5,1]);
 const layout=chartLayout({...frameTime,reference:{value:60}},520,280);
 assert.equal(layout.scale.high,60);assert.equal(layout.scale.low,0);
});

test('grouped bars share one baseline, stay thin and carry before/after change',()=>{
 const layout=chartLayout(frameTime,520,280),baseline=layout.y(0);
 assert.equal(layout.bars.length,6);
 for(const bar of layout.bars){assert.ok(bar.width<=24);assert.ok(Math.abs(bar.y+bar.height-baseline)<1e-6);assert.equal(bar.cap,true);}
 // Taller values are taller bars, in proportion.
 const [before50,after50,,,before99]=layout.bars;assert.ok(Math.abs(before99.height/before50.height-24.5/9.8)<1e-6);assert.ok(before50.height>after50.height);
 // A 2 px surface gap separates neighbours inside a group; groups do not touch.
 assert.equal(Math.round((after50.x-before50.x-before50.width)*1000)/1000,2);assert.ok(layout.bars[2].x-(after50.x+after50.width)>10);
 assert.deepEqual(layout.deltas!.map(value=>Math.round(value!)),[-38,-42,-47]);
 assert.deepEqual(layout.capLabels.map(label=>label.text),['9.8','6.1','16.2','9.4','24.5','13']);
 assert.equal(layout.reference!.label,'60 fps · 16.7');assert.ok(layout.reference!.y<layout.y(16.2)&&layout.reference!.y>layout.y(24.5));
 assert.equal(change(0,5),null);assert.equal(change(null,5),null);assert.equal(change(10,5),-50);assert.equal(formatValue(1234.5,true).replace(/\s/g,' '),'1 235');
});

test('stacked bars pile non-zero parts with gaps, label the total and round only the top part',()=>{
 const layout=chartLayout({type:'bar',stacked:true,categories:['Before','After'],series:[{name:'Shadows',values:[3,2]},{name:'G-buffer',values:[4,2.5]},{name:'Post',values:[0,1]}],unit:'ms'},520,300);
 assert.deepEqual(layout.totals,[7,5.5]);assert.equal(layout.deltas,null);assert.deepEqual(layout.capLabels.map(label=>label.text),['7','5.5']);
 const first=layout.bars.filter(bar=>bar.category===0),second=layout.bars.filter(bar=>bar.category===1);
 assert.equal(first.length,2,'a zero part draws nothing');assert.equal(second.length,3);
 assert.deepEqual(first.map(bar=>bar.cap),[false,true]);assert.deepEqual(second.map(bar=>bar.cap),[false,false,true]);
 // Parts stack upwards without overlapping and leave a 2 px surface gap.
 for(const stack of [first,second])for(let i=1;i<stack.length;i++)assert.ok(Math.abs(stack[i-1].y-(stack[i].y+stack[i].height)-2)<1e-6);
 assert.ok(Math.abs(first[0].y+first[0].height-layout.y(0))<1e-6);
 // Many bars with wide numbers keep the plot clean: values move to the hover readout.
 const dense=chartLayout({type:'bar',categories:Array.from({length:20},(_,i)=>'C'+i),series:[{name:'A',values:Array.from({length:20},(_,i)=>12345.6+i)}]},520,300);
 assert.deepEqual(dense.capLabels,[]);assert.equal(dense.bars.length,20);assert.ok(dense.bars.every(bar=>bar.width>=3));
});

test('a pasted spreadsheet table becomes series and categories',()=>{
 assert.deepEqual(parseTable('\tBefore\tAfter\nP50\t9,8\t6.1\nP95\t16.2\t9.4\n'),{series:['Before','After'],categories:['P50','P95'],values:[['9,8','6.1'],['16.2','9.4']]});
 assert.deepEqual(parseTable('Metric;Before;After\nP50;9.8;6.1')!.series,['Before','After']);
 assert.equal(parseTable('just one line'),null);assert.equal(parseTable('single\ncolumn'),null);
});

test('the Windows desktop bridge lets the host repair and roll back a board but not through read routes',{skip:process.platform!=='win32'},()=>{
 const source=readFileSync('desktop/DesktopWindow.cs','utf8'),begin=source.indexOf('public static class DesktopReadPolicy'),end=source.indexOf('public sealed class DesktopBridgeFailure:');
 const root=mkdtempSync(path.join(tmpdir(),'pocket-board-policy-'));
 try{
  const code=`using System;using System.Text.RegularExpressions;
${source.slice(begin,end)}
class Probe {public static int Main(){if(!DesktopReadPolicy.AllowsWrite("/project-board/repair")||!DesktopReadPolicy.AllowsWrite("/project-board/restore")||!DesktopReadPolicy.Allows("/project-board/backups?root=synthetic"))throw new Exception("Board recovery denied");foreach(var route in new[]{"/project-board/repair","/project-board/restore","/project-board/backups/extra"})if(DesktopReadPolicy.Allows(route))throw new Exception("Unexpected read route");if(DesktopReadPolicy.AllowsWrite("/project-board/backups")||DesktopReadPolicy.AllowsWrite("/project-board/repair/extra"))throw new Exception("Unexpected write route");Console.WriteLine("Board recovery policy passed");return 0;}}`;
  const file=path.join(root,'Probe.cs'),exe=path.join(root,'Probe.exe');writeFileSync(file,code);
  try{execFileSync(path.join(process.env.WINDIR!,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/out:'+exe,file]);}catch(error){throw new Error(String((error as any).stdout));}
  assert.match(execFileSync(exe,{encoding:'utf8'}),/Board recovery policy passed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
