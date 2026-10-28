import './chat-glass.css';
/** Small masked strips blur only the scroll edges; controls stay above them. */
export function ChatEdgeGlass(){return <div className="chat-edge-glass" aria-hidden="true">{(['top','bottom'] as const).map(edge=><div key={edge} className={'chat-edge-glass-'+edge}><i/><i/><i/></div>)}</div>;}
