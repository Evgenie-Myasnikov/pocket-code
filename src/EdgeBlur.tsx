import './edge-blur.css';

/** Two blur layers behind the message field only, fading in at its top: the transcript softens as it passes under the field,
 *  and nothing above the field is blurred. Two layers keep scrolling smooth. After cult-ui's Edge Blur (MIT). */
const LAYERS=[4,12];

export function EdgeBlur(){
  return <div className="chat-edge-blur" aria-hidden="true">{LAYERS.map(radius=><span key={radius} style={{['--blur' as string]:radius+'px'}}/>)}</div>;
}
