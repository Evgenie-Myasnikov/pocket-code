import {lazy,Suspense,type ComponentProps} from 'react';
import type {Review as ReviewPanel} from './Review';
import type {ChatOutputs as OutputsPanel} from './ChatOutputs';
import type {Subagents as SubagentsPanel} from './Subagents';
import type {DocumentLibrary as LibraryPanel} from './DocumentLibrary';

// Panels opened on demand load in their own chunks, so the first chat screen starts with a smaller bundle.
// Each has its own Suspense boundary: loading a panel never replaces the whole app with the root fallback.
const LazyReview=lazy(()=>import('./Review').then(module=>({default:module.Review})));
const LazyOutputs=lazy(()=>import('./ChatOutputs').then(module=>({default:module.ChatOutputs})));
const LazySubagents=lazy(()=>import('./Subagents').then(module=>({default:module.Subagents})));
const LazyLibrary=lazy(()=>import('./DocumentLibrary').then(module=>({default:module.DocumentLibrary})));
export function Review(props:ComponentProps<typeof ReviewPanel>){return <Suspense fallback={null}><LazyReview {...props}/></Suspense>;}
export function ChatOutputs(props:ComponentProps<typeof OutputsPanel>){return <Suspense fallback={null}><LazyOutputs {...props}/></Suspense>;}
export function Subagents(props:ComponentProps<typeof SubagentsPanel>){return <Suspense fallback={null}><LazySubagents {...props}/></Suspense>;}
export function DocumentLibrary(props:ComponentProps<typeof LibraryPanel>){return <Suspense fallback={<div className="loading-skeleton" role="status"><span/><span/></div>}><LazyLibrary {...props}/></Suspense>;}
