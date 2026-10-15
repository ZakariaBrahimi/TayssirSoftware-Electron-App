package app.mizan.pos;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Receipt printers for the web app: lists the Bluetooth devices paired with
 * the phone (Sunmi terminals show their built-in printer as "InnerPrinter")
 * and sends ESC/POS bytes to one of them over the serial port profile.
 */
@CapacitorPlugin(
    name = "MizanPrinter",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class MizanPrinterPlugin extends Plugin {

    /** Serial Port Profile, used by Bluetooth thermal printers. */
    private static final UUID SPP = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void info(PluginCall call) {
        Context context = getContext();
        // The google-services plugin adds this resource when Firebase is set up.
        int id = context.getResources().getIdentifier("google_app_id", "string", context.getPackageName());
        JSObject result = new JSObject();
        result.put("version", BuildConfig.VERSION_NAME);
        result.put("pushAvailable", id != 0);
        call.resolve(result);
    }

    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "listAfterPermission");
            return;
        }
        list(call);
    }

    @PermissionCallback
    private void listAfterPermission(PluginCall call) {
        if (needsPermission()) {
            call.reject("Bluetooth permission refused", "PERMISSION");
            return;
        }
        list(call);
    }

    @SuppressLint("MissingPermission")
    private void list(PluginCall call) {
        BluetoothAdapter bt = adapter();
        if (bt == null || !bt.isEnabled()) {
            call.reject("Bluetooth is off", "BLUETOOTH_OFF");
            return;
        }
        JSArray devices = new JSArray();
        Set<BluetoothDevice> bonded = bt.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice device : bonded) {
                JSObject d = new JSObject();
                String name = device.getName();
                d.put("name", name == null ? device.getAddress() : name);
                d.put("address", device.getAddress());
                devices.put(d);
            }
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bluetooth", call, "printAfterPermission");
            return;
        }
        send(call);
    }

    @PermissionCallback
    private void printAfterPermission(PluginCall call) {
        if (needsPermission()) {
            call.reject("Bluetooth permission refused", "PERMISSION");
            return;
        }
        send(call);
    }

    @SuppressLint("MissingPermission")
    private void send(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || data == null) {
            call.reject("address and data are required");
            return;
        }
        BluetoothAdapter bt = adapter();
        if (bt == null || !bt.isEnabled()) {
            call.reject("Bluetooth is off", "BLUETOOTH_OFF");
            return;
        }
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                bt.cancelDiscovery();
                BluetoothDevice device = bt.getRemoteDevice(address);
                socket = device.createRfcommSocketToServiceRecord(SPP);
                socket.connect();
                OutputStream out = socket.getOutputStream();
                // Small chunks: cheap printers have small input buffers.
                for (int i = 0; i < bytes.length; i += 2048) {
                    out.write(bytes, i, Math.min(2048, bytes.length - i));
                    out.flush();
                    Thread.sleep(15);
                }
                // Let the printer read everything before the link closes.
                Thread.sleep(300);
                call.resolve();
            } catch (Exception e) {
                call.reject("Printing failed: " + e.getMessage(), "PRINT_FAILED", e);
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {
                        // already closed
                    }
                }
            }
        }).start();
    }
}
