/*
 * affine.js
 *
 *  copyright (c) Mike Sokolov, 2002, 2013
 *
 * Represents a two-dimensional affine transformation
 * defined by the mapping of a vector v1->v2 on to (0,0)->(0,1)
 */

function Affine (v1, v2) {
    // Defines a transform that maps the vector v1->v2 on to the y axis
    var dx, dy, r;
    dx = v2.x - v1.x;
    dy = v2.y - v1.y;
    r = Math.sqrt (dx*dx + dy*dy);
    this.xx = dy / r;
    this.xy = - dx / r;
    this.yx = - this.xy;
    this.yy = this.xx;
    this.xoff = 0; // used in distance
    this.xoff = -this.distance ((v1.x + v2.x)/2, (v1.y + v2.y) / 2);
    this.yoff = 0;
    if (Math.abs(this.distance (v1.x, v1.y)) > 0.001 || Math.abs(this.distance (v2.x, v2.y)) > 0.001) {
        console.error ("Affine bad xform:" + Math.abs(this.distance (v1.x, v1.y))+ "," +
                       Math.abs(this.distance (v2.x, v2.y)) + ", xoff=" + xoff);
    }
    if (isNaN(this.xx) || isNaN(this.xy) || isNaN(this.xoff)) {
        console.error ("bad Affine transform from " + v1.string() + "," + v2.string());
        console.error ("xx=" + this.xx + ", xy=" + this.xy + ", xoff=" + this.xoff);
    }
}

Affine.prototype.transform = function (x, y) {
    res = [];
    res.length = 2;
    res[0] = this.xx*x + this.xy*y + this.xoff;
    res[1] = this.yx*x + this.yy*y + this.yoff;
    return res;
}

Affine.prototype.distance = function (x, y) {
    return this.xx*x + this.xy*y + this.xoff;
}
