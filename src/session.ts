import type {WorkspaceProvider} from './preferences';
/** Shared session metadata used by the mobile workspace and desktop reader. */
export type Session={sessionId:string;summary:string;customTitle?:string;cwd?:string;lastModified:number;gitBranch?:string;source?:string;readOnly?:boolean;archived?:boolean;provider?:WorkspaceProvider;board?:BoardLink;account?:string};
/** The board a chat was started from (host chat library). */
export type BoardLink={id:string;root:string;title:string;noteId?:string;kind?:'discussion'|'note'|'task'};
