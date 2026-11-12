import type {WhiteboardChart as Chart} from './whiteboard-model';

/** Clean axis steps: 1, 2 or 5 times a power of ten. */
export function niceScale(min:number,max:number,ticks=4){
 if(!(max>min)){max=min+1;}
 const rough=(max-min)/ticks,power=Math.pow(10,Math.floor(Math.log10(rough))),unit=rough/power,step=(unit<=1?1:unit<=2?2:unit<=5?5:10)*power;
 const low=Math.floor(min/step+1e-9)*step,high=Math.ceil(max/step-1e-9)*step,values:number[]=[];
 for(let value=low;value<=high+step/2;value+=step)values.push(Number(value.toPrecision(12)));
 return {low,high,step,values};
}
const digits=(step:number)=>Math.max(0,Math.min(6,-Math.floor(Math.log10(step)+1e-9)));
export function formatValue(value:number,ru:boolean,fraction?:number){
 const places=fraction??(Math.abs(value)>=100?0:Math.abs(value)>=10?1:2);
 return value.toLocaleString(ru?'ru-RU':'en-US',{maximumFractionDigits:places,minimumFractionDigits:0});
}
/** Signed change of the second value against the first, as a percentage. */
export function change(before:number|null,after:number|null){return before===null||after===null||before===0?null:(after-before)/Math.abs(before)*100;}
export type ChartLayout=ReturnType<typeof chartLayout>;
/** Geometry is plain arithmetic on the stored numbers, so it can be tested without a browser. */
export function chartLayout(chart:Chart,width:number,height:number,ru=false){
 const stacked=!!chart.stacked,categories=chart.categories.length,seriesCount=chart.series.length;
 const totals=chart.categories.map((_,c)=>chart.series.reduce((sum,series)=>sum+(series.values[c]??0),0));
 const all=chart.series.flatMap(series=>series.values.filter((value):value is number=>value!==null));
 const top=Math.max(0,...(stacked?totals:all),chart.reference?.value??0),bottom=Math.min(0,...(stacked?[]:all),chart.reference?.value??0);
 const scale=niceScale(bottom,top),fraction=digits(scale.step),tickLabels=scale.values.map(value=>formatValue(value,ru,fraction));
 const deltas=!stacked&&seriesCount===2?chart.categories.map((_,c)=>change(chart.series[0].values[c],chart.series[1].values[c])):null;
 const left=Math.min(96,Math.max(...tickLabels.map(label=>label.length))*7+12),bottomSpace=deltas?44:26,plot={x:left,y:24,width:Math.max(40,width-left-10),height:Math.max(40,height-24-bottomSpace)};
 const y=(value:number)=>plot.y+plot.height*(1-(value-scale.low)/(scale.high-scale.low)),band=plot.width/categories;
 const perBand=stacked?1:seriesCount,gap=2,thickness=Math.max(3,Math.min(24,(band*.8-gap*(perBand-1))/perBand)),groupWidth=thickness*perBand+gap*(perBand-1);
 const bars:{series:number;category:number;value:number;x:number;y:number;width:number;height:number;cap:boolean;label:string}[]=[];
 chart.categories.forEach((_,c)=>{
  const start=plot.x+band*c+(band-groupWidth)/2;let offset=0;
  chart.series.forEach((series,s)=>{
   const value=series.values[c];if(value===null)return;
   if(stacked){const from=y(offset),to=y(offset+value),last=!chart.series.slice(s+1).some(next=>(next.values[c]??0)>0);offset+=value;if(value<=0)return;bars.push({series:s,category:c,value,x:start,y:to+(last?0:gap),width:thickness,height:Math.max(1,from-to-(last?0:gap)),cap:last,label:formatValue(value,ru)});}
   else{const zero=y(0),at=y(value);bars.push({series:s,category:c,value,x:start+s*(thickness+gap),y:Math.min(zero,at),width:thickness,height:Math.max(1,Math.abs(zero-at)),cap:true,label:formatValue(value,ru)});}
  });
 });
 // A value sits on its cap only when every label fits its bar slot; otherwise the axis and the hover readout carry the numbers.
 const capLabels=stacked?totals.map((total,c)=>({x:plot.x+band*c+band/2,y:y(total)-5,text:formatValue(total,ru)})):bars.map(bar=>({x:bar.x+bar.width/2,y:(bar.value>=0?bar.y:bar.y+bar.height+11)-5,text:bar.label}));
 const slot=stacked?band:thickness+gap,showCaps=capLabels.length<=16&&capLabels.every(label=>label.text.length*6.2<=Math.max(slot,22)+2);
 const categoryChars=Math.max(3,Math.floor(band/6.4));
 return {stacked,plot,scale,tickLabels,y,band,bars,totals,deltas,capLabels:showCaps?capLabels:[],categoryLabels:chart.categories.map((label,c)=>({x:plot.x+band*c+band/2,text:label.length>categoryChars?label.slice(0,Math.max(1,categoryChars-1))+'…':label,full:label})),reference:chart.reference?{y:y(chart.reference.value),label:(chart.reference.label?chart.reference.label+' · ':'')+formatValue(chart.reference.value,ru)}:null};
}
/** Spreadsheet text: the first row names the series, each following row is a category and its values. */
export function parseTable(text:string){
 const rows=text.replace(/\r/g,'').split('\n').filter(row=>row.trim()).map(row=>row.split(row.includes('\t')?'\t':/[;,](?=\S|$)/).map(value=>value.trim()));
 if(rows.length<2||rows[0].length<2)return null;
 return {series:rows[0].slice(1),categories:rows.slice(1).map(row=>row[0]),values:rows.slice(1).map(row=>rows[0].slice(1).map((_,index)=>row[index+1]??''))};
}
