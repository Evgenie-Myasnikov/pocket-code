package app.pocketcode.mobile;

import android.app.Activity;
import android.content.Intent;
import android.speech.RecognizerIntent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;

/** The OS owns microphone consent and recording; only recognized text is returned. */
@CapacitorPlugin(name="VoiceInput")
public class VoiceInputPlugin extends Plugin {
    private boolean listening=false;
    @PluginMethod public void recognize(PluginCall call){
        if(listening){call.reject("Dictation is already open");return;}
        Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,call.getString("language","en-US"));
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
        listening=true;
        try{startActivityForResult(call,intent,"recognized");}
        catch(Exception error){listening=false;call.reject("Speech recognition is unavailable. Install or enable a speech service on this device.");}
    }
    @ActivityCallback private void recognized(PluginCall call,ActivityResult result){
        listening=false;if(call==null)return;
        ArrayList<String> words=result.getResultCode()==Activity.RESULT_OK&&result.getData()!=null?result.getData().getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS):null;
        JSObject reply=new JSObject();reply.put("text",words!=null&&!words.isEmpty()?words.get(0):"");reply.put("cancelled",result.getResultCode()!=Activity.RESULT_OK);call.resolve(reply);
    }
}
