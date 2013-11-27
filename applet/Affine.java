/* two-dimensional affine transformation */
class Affine {
    double xoff, yoff, xx, xy, yx, yy;

    Affine (Vertex v1, Vertex v2) {
        // Defines a transform that maps the vector v1->v2 on to the y axis
        double dx, dy, r;
        dx = v2.x - v1.x;
        dy = v2.y - v1.y;
        r = Math.sqrt (dx*dx + dy*dy);
        xx = dy / r;
        xy = - dx / r;
        yx = - xy;
        yy = xx;
        xoff = 0;
        xoff = -distance ((v1.x + v2.x)/2, (v1.y + v2.y) / 2);
        yoff = 0;
        if (Math.abs(distance (v1.x, v1.y)) > 0.001 || Math.abs(distance (v2.x, v2.y)) > 0.001) {
            System.out.println ("Affine bad xform:" + Math.abs(distance (v1.x, v1.y))+ "," +
                                Math.abs(distance (v2.x, v2.y)) + ", xoff=" + xoff);
        }
    }

    double [] transform (double x, double y) {
        double [] res = new double[2];
        res[0] = xx*x + xy*y + xoff;
        res[1] = yx*x + yy*y + yoff;
        return res;
    }

    double distance (double x, double y) {
        double x1, y1;
        x1 = xx*x + xy*y + xoff;
        return x1;
    }
}
