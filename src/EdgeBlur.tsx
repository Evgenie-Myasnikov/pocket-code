import './edge-blur.css';

/** Blur layers of growing radius, each fading out upwards: the transcript melts into the message field instead of ending at an edge. After cult-ui's Edge Blur (MIT). */
const LAYERS=[1,2,3,6,12];

export function EdgeBlur(){
  return <div className="chat-edge-blur" aria-hidden="true">{LAYERS.map(radius=><span key={radius} style={{['--blur' as string]:radius+'px'}}/>)}</div>;
}
