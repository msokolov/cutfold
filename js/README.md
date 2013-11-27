# Cutfold javascript port

This was ported from the Java applet version; all classes were turned into
prototypes and animation/drawing code was converted from AWT to HTML
canvas.

The code is fairly similar, but here is list of the kinds of changes that were made when porting:

* member variable access in prototypes must be qualified by "this."
* canvas doesn't properly support XOR drawing mode, so drawing the folding cursor now requires a total redraw of the surface.  However this seems to perform well enough that it's not a problem.
* canvas does double buffering for you, so that code was abandoned
* eliminated my own js bubble sort for the native array.sort
* animation was performed in an inner loop, but canvas requires us to relinquish control; now works using a timer and callback.

* all the code to save to the gallery and generate pdfs was disabled for this initial version

I added some more comments where I could figure out what was going on, but
overall I have to say this code is quite complex, and grew organically.  On
the one hand, it could really benefit from some basic reorganization: the
division of functions into controller/view classes is somewhat arbitrary
(the data model is basically fine).  Also, the data model and geometry
really require more documentation than is currently provided.  There are
all kinds of clever hacks going on that are completely opaque to the
reader.
