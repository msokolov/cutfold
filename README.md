cutfold
=======

virtual paper cut and fold snowflake simulation

## history

This little exercise in interactive geometry was started as a flash "movie"
written in ActionScript in 2002. But flash was really designed for
animating sprites, and not for handling scripted primitive drawing commands
(lines and polygons).  So the java applet version was born, and development
on that continued for a couple of years, during which time many features
got added, including a gallery where you could save snowflakes for others
to see, and even download a pdf version of your snowflake.

Over the years, applet technology has become even less widespread and more
finicky, and we finally have a decent alternative to applets for
interactive animation on the web: html5 canvas. So now in 2013 it seemed
maybe the time had come to rejuvenate cutfold. The current incarnation is a
port to javascript and canvas.

The basics (folding) is now working, but there is still some work needed to
wire up cut and unfold.

## how to use

  You can *fold* the paper by (clicking fold and) dragging a line segment
across it. Then clicking on one side or the other of your fold will push
that side down, executing the fold.

  You can *cut* the paper by (clicking cut and) drawing a series of
connected lines by repeatedly clicking and moving the mouse; the cutting is
finalized with a *double-click* (or by crossing your own cutting
line).

  You can *discard* pieces of paper.  Be careful where you click: There is
only one level of undo.

  You can *unfold* - this unfolds the most recent fold, and can be repeated until the paper is completely flat.

