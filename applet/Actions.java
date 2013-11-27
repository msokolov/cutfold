import java.awt.*;
import java.awt.event.*;

class Actions implements ActionListener {

    // link to main applet object
    Cutfold app;

    public Actions (Cutfold app) {
        this.app = app;
    }

    public void runCommand (String cmd) {

        CFPanel pane = app.pane;
        // System.out.println (cmd);
        if (cmd.equals ( "fold" )) {
            pane.setMode ("fold");
        } else if (cmd.equals ( "cut" )) {
            pane.setMode ("cut");
        } else if (cmd.equals ( "unfold" )) {
            app.unfold_once ();
            pane.setMode ("");
        } else if (cmd.equals ( "undo" )) {
            app.undo ();
            pane.setMode ("");
            /*
        } else if (cmd.equals ( "recenter" )) {
            app.rescale_canvas ();
            app.mode = "";
            */
        } else if (cmd.equals ( "discard" )) {
            pane.setMode ("discard");
            // } else if (cmd.equals ( "print" )) {
            // app.print();
        } else if (cmd.equals ( "save" )) {
            app.postURL();
        } else if (cmd.equals ( "reset" )) {
            app.reset ();
            pane.setMode ("fold");
        } else if (cmd.equals ( "spin" )) {
            app.spin ();
            /*
        } else if (cmd.equals ( "help" )) {
            pane.show_help ();
            */
        } else if (cmd.equals("step")) {
            app.step();
        } else if (cmd.equals("exit")) {
            System.exit (0);
        }
    }

    public void actionPerformed (ActionEvent evt) {
        String cmd = evt.getActionCommand ();

        if (app.script != null) {
            if (cmd != "step" && cmd != "exit") {
                // The step command is used to read from the script,
                // so don't write it to the script file!
                app.script.captureAction (cmd); // for debugging
            }
        }
        runCommand (cmd);
    }
}
