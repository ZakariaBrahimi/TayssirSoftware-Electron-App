package app.mizan.pos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugin (Bluetooth / Sunmi receipt printers).
        registerPlugin(MizanPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
