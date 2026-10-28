import {ComposerPrimitive,useAui} from '@assistant-ui/react';
import {useEffect,type ComponentPropsWithRef} from 'react';
import {useAssistantChat} from './AssistantChat';

/** Provider transport owns drafts and attachments; assistant-ui supplies the input surface. */
export function AssistantComposerInput(props:Omit<ComponentPropsWithRef<typeof ComposerPrimitive.Input>,'submitMode'|'submitOnEnter'>){
 const bridge=useAssistantChat();
 return bridge?<RuntimeInput {...props}/>:<textarea {...props}/>;
}
function RuntimeInput(props:Omit<ComponentPropsWithRef<typeof ComposerPrimitive.Input>,'submitMode'|'submitOnEnter'>){
 const runtime=useAui();
 useEffect(()=>{const text=String(props.value||'');if(runtime.composer.getState().text!==text)runtime.composer.setText(text);},[runtime,props.value]);
 return <ComposerPrimitive.Input {...props} submitMode="none" cancelOnEscape={false} addAttachmentOnPaste={false} />;
}
export function AssistantComposerRoot(props:ComponentPropsWithRef<'div'>){
 // Provider controls have their own actions; a container avoids implicit form submits.
 return useAssistantChat()?<ComposerPrimitive.Root asChild><div {...props}/></ComposerPrimitive.Root>:<div {...props}/>;
}
