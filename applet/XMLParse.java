import java.io.*;
import java.util.Hashtable;

/* XMLParse implements a very limited XML-style lexical-type parse.  It doesn't check that
   tags are properly nested or attempt to ensure that documents adhere to a DTD.  It
   doesn't handle entities.  It ignores anything in between tags (CTYPE?).
   It does return tags one at a time storing their attributes
   in the attr hash. */

class XMLParse {

    StreamTokenizer in;
    Hashtable attrs;

    XMLParse (InputStream is) {
        in = new StreamTokenizer (new BufferedReader(new InputStreamReader(is)));
        in.lowerCaseMode (true);
        in.ordinaryChar ('=');  // recognize > as end of tag token
        in.ordinaryChar ('<');  // recognize > as end of tag token
        in.ordinaryChar ('>');  // recognize > as end of tag token
        in.wordChars ('/', '/');  // disable default comment behavior
        in.wordChars ('_', '_');
        attrs = new Hashtable ();
    }

    String nextTag () throws IOException {
        attrs.clear();
        int ttype;
        while ((ttype = in.nextToken()) != java.io.StreamTokenizer.TT_EOF) {
            if (ttype == '<')
                break;
            // System.out.println ("ignoring: " + in.sval);
        }
        if (ttype == java.io.StreamTokenizer.TT_EOF) return null;
        ttype = in.nextToken ();
        if (ttype == java.io.StreamTokenizer.TT_EOF) return null;
        if (ttype != java.io.StreamTokenizer.TT_WORD) return null; // raise an error?
        String tag = new String (in.sval);
        while ((ttype = in.nextToken()) != java.io.StreamTokenizer.TT_EOF) {
            if (ttype == '>')
                return tag;
            if (ttype == java.io.StreamTokenizer.TT_WORD) {
                String attr = new String (in.sval);
                ttype = in.nextToken ();
                if (ttype != '=') {
                    // valueless attribute
                    System.out.println ("valueless attribute " + attr);
                    in.pushBack();
                    attrs.put (attr, null);
                    continue;
                }
                ttype = in.nextToken ();
                if (ttype == java.io.StreamTokenizer.TT_EOF) {
                    return null;
                } else if (ttype == java.io.StreamTokenizer.TT_WORD || ttype == '"') {
                    attrs.put (attr, new String (in.sval));
                } else if (ttype == java.io.StreamTokenizer.TT_NUMBER) {
                    attrs.put (attr, new Double (in.nval));
                } else {
                    System.out.println ("unexpected token " + ttype);
                }
            }
        }
        return tag;
    }
}
