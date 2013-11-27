import java.awt.*;
import java.awt.event.*;
import java.io.*;

class Script {

    String path;
    FileWriter writer;
    BufferedReader reader;
    boolean writing;

    public Script (String path) {
        this.path = path;
    }

    public void captureMousePress (MouseEvent evt) {
        String s = "mousePressed " + evt.getX() + " " + evt.getY() + " " + evt.getClickCount();
        write_line (s);
    }

    public void captureMouseRelease (MouseEvent evt) {
        String s = "mouseReleased " + evt.getX() + " " + evt.getY() + " " + evt.getClickCount();
        write_line (s);
    }
    
    public void captureAction (String action) {
        write_line (action);
    }

    void write_line (String line) {
        if (reader != null) {
            System.out.println ("Script: can't write to reader");
            return;
        }
        try {
            if (writer == null) {
                System.out.println ("dumping script to " + path);
                writer = new FileWriter (path);
            }
            writer.write (line + "\n");
            writer.flush ();
        } catch (IOException e) {
            System.out.println ("In Script.write_line, error writing to " + path);
            System.out.println (e);
        }
    }

    public String read_line () {
        if (writer != null) {
            System.out.println ("Script: can't read from writer");
            return "";
        }
        try {
            if (reader == null) {
                System.out.println ("loading script from " + path);
                reader = new BufferedReader (new FileReader (path));
            }
            return reader.readLine ();
        } catch (FileNotFoundException e) {
            System.out.println ("In Script.read_line, file not found: " + path);
            return "";
        } catch ( IOException io) {
            System.out.println ("In Script.read_line: " + io);
            return "";
        }
    }

    public void close () {
        try {
            if (writer != null) {
                writer.close ();
                writer = null;
            }
            if (reader != null) {
                reader.close();
                reader = null;
            }
        } catch (IOException io) {
            System.out.println ("error closing Script: " + io);
        }
    }

}
