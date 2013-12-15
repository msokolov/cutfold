#!/usr/bin/perl

use warnings;
use strict;

use HTML::Macro;
use CGI qw/-oldstyle_urls/;

MAIN: 
{
    my ($query) = new CGI;
    my $pfmfile;                # some web servers screw this up
    if ($query->path_translated())
    {
        $pfmfile = $query->path_translated();
        $pfmfile =~ s|\\|/|g;
    }
    my $htm = new HTML::Macro ($pfmfile, 
                               { cache_files => 1, collapse_blank_lines => 1});
    foreach my $param ($query->param)
    {
        # we used to support multiple values by joining them with a comma.
        # but this is not really all that useful.  Now we just take the first 
        # one.
        my $val;
        my @vals = $query->param($param);
        if (@vals > 1) {
            print STDERR "Ignoring multiple values for '$param': (@vals)\n";
            $val = $vals[0];
        } else {
            $val = $query->param($param);
        }
        $htm->set($param, $val);
        #print STDERR "PARAM: $param=", $query->param($param), "\n";
    }

    my $buf = $htm->print;
}

sub list_gallery 
{
    my ($htm) = @_;
    my $maxseq = 0;
    if (open (SEQUENCE, "sequence")) {
        $maxseq = <SEQUENCE>;
        close SEQUENCE;
        $maxseq = int ($maxseq);
    }

    my $seqnum;
    if (defined $htm->get('seqnum')) {
        $seqnum = $htm->get('seqnum');
    } else
    {
        $seqnum = $maxseq;
    }
    if ($seqnum < $maxseq) {
        $htm->set ('next_seq', $seqnum + 20);
    }

    my $count = 0;
    my $rows = $htm->new_loop ('gallery_rows', 'rownum');
    my $cols;
    while ($seqnum > 0 && $count < 20) {
        my $file = "model$seqnum.xml";
        if ( -e $file ) {
            if ($count % 5 == 0) {
                $rows->push_array (int ($count / 5));
                $cols = $rows->new_loop ('gallery_cells', 'id', 'caption',
                                         'pdf_url');
            }
            my $pdf_url = "model$seqnum.pdf";
            $cols->push_array ($seqnum, &getcaption ($seqnum),
                               -e $pdf_url ? $pdf_url : undef);
            ++ $count;
        }
        -- $seqnum;
    }
    while ($seqnum > 0) {
        if ( -e "model$seqnum.xml" ) {
            $htm->set ('prev_seq', $seqnum);
            last;
        }
        -- $seqnum;
    }
    return $htm->process;
}

sub showmodel
{
    my ($htm) = @_;
    my $id = $htm->get ('id');
    $htm->set ('caption', &getcaption($id));
    $htm->set ('readonly', 1) if ! defined $htm->get ('readonly');
    return $htm->process;
}

sub getcaption
{
    my ($id) = @_;
    open (MODEL, "model$id.xml");
    $/ = undef;
    my $xml = <MODEL>;
    if ($xml =~ m|<caption>(.*)</caption>|) {
        return $1;
    }
    return '';
}
