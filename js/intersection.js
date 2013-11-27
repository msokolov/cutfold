/*
 * intersection.js
 *
 *  copyright (c) Mike Sokolov, 2002, 2013
 *
 * An intersection of a vector with a polygon
 */

function Intersection (pt, edge, t, is_crease) {
    this.pt = pt;     // the location of the intersection
    this.edge = edge; // the intersected edge of a polygon  (edge -> edge.next)
    this.t = t;       // the normalized distance from the intersecting edge's start point
    this.is_crease = is_crease;
}
