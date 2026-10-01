package app.pocketcode.mobile;

/** Suppress old completed history while allowing fast jobs and observed transitions. */
final class ChatAlertState {
    private String activeJob="";
    void reset(){activeJob="";}
    boolean observe(String job,String state,long jobStarted,long watchStarted){
        if(state.equals("running")||state.equals("needs_input"))activeJob=job;
        return state.equals("needs_input")||((state.equals("done")||state.equals("error")||state.equals("stopped"))&&(job.equals(activeJob)||jobStarted>=watchStarted));
    }
}
