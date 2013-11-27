#!/usr/bin/perl

use strict;
use warnings;

use Fcntl ':flock';

use XMLParse;

use GD;

use lib '.';
use PDF::Create;

MAIN:
{
    chdir 'gallery' || die "can't chdir gallery: $!";
    my $num = &seq_next;
    $/ = undef;
    my $xml = <STDIN>;
    open (XML, ">model$num.xml") || die "can't create model$num.xml: $!";
    print XML $xml;
    close XML;
    &save_png ($xml, "thumb$num.png");
    &save_pdf ($xml, "model$num.pdf");
    print "Content-Type: text/plain\n\nOK\n";
}

sub save_png
{
    my ($xml, $filename) = @_;
    my $im = new GD::Image (100, 100);
    my $white = $im->colorAllocate(255,255,255);
    my $grey = $im->colorAllocate(20,20,40);     
    my $tan = $im->colorAllocate(220,220,180);
    $im->transparent($white);

    my $parser = new XMLParse ($xml);
    my ($ptag, $poly, $v);
    my @polys = ();
    my ($xmin, $ymin, $xmax, $ymax) = (1000, 1000, -1000, -1000);
    while (my $tag = $parser->next()) {
        if ($tag eq 'polygon') {
            die 'nested polygons' if ($poly);
            $poly = { 'gdp' => new GD::Polygon,
                      'z' => $parser->{'attrs'}->{'z'},
                      'faceup' => ($parser->{'attrs'}->{'faceup'} eq 'true' ? 1 : 0),
                  };
        } elsif ($tag eq '/polygon') {
            push @polys, $poly;
            $poly = undef;
            $v = undef;
        } elsif ($tag eq 'vertex') {
            die 'nested vertices' if $v;
            die 'vertex outside polygon' if ! $poly;
            # maybe deal w/creases?
            #print STDERR "x=", $parser->{'attrs'}->{'x'}, "y=", $parser->{'attrs'}->{'y'}, "\n";
            my ($x, $y) = ($parser->{'attrs'}->{'x'}, $parser->{'attrs'}->{'y'});
            $xmin = $x if ($x < $xmin);
            $xmax = $x if ($x > $xmax);
            $ymin = $y if ($y < $ymin);
            $ymax = $y if ($y > $ymax);
            $poly->{'gdp'}->addPt ($x, $y);
            $v = 1;
        } elsif ($tag eq '/vertex') {
            $v = 0;
        }
        # ignore folds
    }
    # sort polygons in reverse z-order (set up to draw higher-z polys first ; they're in the distance)
    @polys = sort { $a->{'z'} <=> $b->{'z'} } @polys;
    foreach $poly (@polys) {
        my $gdp = $poly->{'gdp'};
        die "not a GD::Polygon?" if (!$gdp || ref $gdp ne 'GD::Polygon');
        die "bad im?" if (!$im || ref $im ne 'GD::Image');
        $gdp->map ($xmin, $ymin, $xmax, $ymax, 1, 1, 99, 99);
        $im->filledPolygon ($gdp, $tan);
        $im->polygon ($gdp, $grey);
    }
    open (PNG, ">$filename") || die "can't create $filename: $!";
    print PNG $im->png;
    close PNG;
}

sub save_pdf
{
    my ($xml, $filename) = @_;
    my $pdf = new PDF::Create ('filename' => $filename,
                               'Creator' => 'cutfold');

    # 8-1/2 x 11 inches times 72 dpi is the default pdf coord space:
    my $page_width = 612;
    my $page_height = 792;
    my $margin = 36;            # 1/2 inch margin on all sides

    my $page = $pdf->new_page
        ('MediaBox' => [ 0, 0, $page_width, $page_height ]);

    my $f1 = $pdf->font('Subtype'  => 'Type1',
 	   	        'Encoding' => 'WinAnsiEncoding',
 		        'BaseFont' => 'Helvetica');

    if ($xml =~ m|<caption>(.*)</caption>|) {
        $page->stringc($f1, 16, $page_width/2, 30, $1);
    }

    # set colors
    $page->fill_rgb (220/255,220/255,180/255);
    $page->stroke_rgb (20/255,20/255,40/255);

    my $parser = new XMLParse ($xml);
    my ($ptag, $poly, $v);
    my @polys = ();
    my ($xmin, $ymin, $xmax, $ymax) = (1000, 1000, -1000, -1000);
    while (my $tag = $parser->next()) {
        if ($tag eq 'polygon') {
            die 'nested polygons' if ($poly);
            $poly = { 'z' => $parser->{'attrs'}->{'z'},
                      'faceup' => ($parser->{'attrs'}->{'faceup'} eq 'true' ? 1 : 0),
                  };
        } elsif ($tag eq '/polygon') {
            push @polys, $poly;
            $poly = undef;
            $v = undef;
        } elsif ($tag eq 'vertex') {
            die 'nested vertices' if $v;
            die 'vertex outside polygon' if ! $poly;
            # maybe deal w/creases?
            #print STDERR "x=", $parser->{'attrs'}->{'x'}, "y=", $parser->{'attrs'}->{'y'}, "\n";
            my ($x, $y) = ($parser->{'attrs'}->{'x'}, $parser->{'attrs'}->{'y'});
            $xmin = $x if ($x < $xmin);
            $xmax = $x if ($x > $xmax);
            $ymin = $y if ($y < $ymin);
            $ymax = $y if ($y > $ymax);
            push @ {$poly->{'points'}}, [ $x, $y ];
            $v = 1;
        } elsif ($tag eq '/vertex') {
            $v = 0;
        }
        # ignore folds
    }
    # sort polygons in reverse z-order (set up to draw higher-z polys first ; they're in the distance)
    @polys = sort { $a->{'z'} <=> $b->{'z'} } @polys;
    my $width = $xmax - $xmin;
    my $height = $ymax - $ymin;
    my $ww = $page_width -  2*$margin;
    my $hh = $page_height -  2*$margin;
    my $scale = ($width / $ww) > ($height / $hh) ? 
        ($width / $ww) : ($height / $hh);

    # This flips the polygons upside down, but that seems OK - they're usually
    # symmetric about the x-axis anyway, or as close as nobody's business

    foreach $poly (@polys) {
        my $pt = shift @ {$poly->{'points'}};
        $page->moveto ($page_width/2 + $$pt[0]/$scale,
                       $page_height/2 + $$pt[1]/$scale);
        foreach $pt (@ {$poly->{'points'}}) {
            $page->lineto ($page_width/2 + $$pt[0]/$scale,
                           $page_height/2 + $$pt[1]/$scale);
        }
        $page->closefillstroke;
    }
    $pdf->close;
}

sub seq_next
{
    my $seqnum;
    if ( ! -e 'sequence' ) {
        open (SEQ, ">sequence")  || die "can't open sequence: $!";
        $seqnum = 0;
    } else {
        open (SEQ, "+<sequence") || die "can't open sequence: $!";
        $seqnum = <SEQ>;
    }
    flock (SEQ, LOCK_EX);
    seek SEQ, 0, 0;
    ++ $seqnum;
    print SEQ "$seqnum\n";
    flock (SEQ, LOCK_UN);
    close SEQ;
    return $seqnum;
}

