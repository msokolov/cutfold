# -*- mode: Perl -*-

# PDF::Create - create PDF files
# Author: Fabien Tassin <fta@oleane.net>
# Version: 0.01
# Copyright 1999 Fabien Tassin <fta@oleane.net>

# bugs:
# - ...

package PDF::Create;

use strict;
use vars qw(@ISA @EXPORT $VERSION $DEBUG);
use Exporter;
use Carp;
use FileHandle;
use PDF::Create::Page;
use PDF::Create::Outline;

@ISA     = qw(Exporter);
@EXPORT  = qw();
$VERSION = 0.01;
$DEBUG   = 0;

sub new {
  my $this = shift;
  my %params = @_;

  my $class = ref($this) || $this;
  my $self = {};
  bless $self, $class;
  $self->{'data'}    = '';
  $self->{'version'} = $params{'Version'} || "1.2";
  $self->{'trailer'} = {};

  $self->{'pages'} = new PDF::Create::Page();
  $self->{'current_page'} = $self->{'pages'};
  $self->{'pages'}->{'pdf'} = $self; # circular reference
  $self->{'page_count'} = 0;

  $self->{'outline_count'} = 0;

  $self->{'crossreftblstartaddr'} = 0; # cross-reference table start address
  $self->{'generation_number'} = 0;
  $self->{'object_number'} = 0;

  if (defined $params{'fh'}) {
    $self->{'fh'} = $params{'fh'};
  }
  elsif (defined $params{'filename'}) {
    $self->{'filename'} = $params{'filename'};
    my $fh = new FileHandle "> $self->{'filename'}";
    carp "Error: can't open $self->{'filename'}: $!\n" unless defined $fh;
    $self->{'fh'} = $fh;
  }
  $self->{'catalog'} = {};
  $self->{'catalog'}{'PageMode'} = $params{'PageMode'}
    if defined $params{'PageMode'};

  # Header: add version
  $self->add_version;
  # Info
  $self->{'Author'} =   $params{'Author'}   if defined $params{'Author'};
  $self->{'Creator'} =  $params{'Creator'}  if defined $params{'Creator'};
  $self->{'Title'} =    $params{'Title'}    if defined $params{'Title'};
  $self->{'Subject'} =  $params{'Subject'}  if defined $params{'Subject'};
  $self->{'Keywords'} = $params{'Keywords'} if defined $params{'Keywords'};
  return $self;
}

sub close {
  my $self = shift;
  my %params = @_;

  $self->page_stream;
  $self->add_outlines if defined $self->{'outlines'};
  $self->add_catalog;
  $self->add_pages;
  $self->add_info;
  $self->add_crossrefsection;
  $self->add_trailer;
  $self->{'fh'}->close
    if defined $self->{'fh'} && defined $self->{'filename'};
}

sub debug {
  return unless $DEBUG;
  my $self = shift;
  my $msg = shift;

  my $s = scalar @_ ? sprintf $msg, @_ : $msg;
  warn "PDF DEBUG: $s\n";
}

sub version {
  my $self = shift;
  my $v = shift;

  if (defined $v) {
    # TODO: should test version (1.0 to 1.3)
    $self->{'version'} = $v;
  }
  $self->{'version'};
}

# Add some data to the current PDF structure.
sub add {
  my $self = shift;
  my $data = join '', @_;
  $self->{'size'} += length $data;
  if (defined $self->{'fh'}) {
    my $fh = $self->{'fh'};
    print $fh $data;
  }
  else {
    $self->{'data'} .= $data;
  }
}

# Get the current position in the PDF
sub position {
  my $self = shift;

  $self->{'size'};
}

# Reserve the next object number for the given object type.
sub reserve {
  my $self = shift;
  my $name = shift;
  my $type = shift || $name;

  die "Error: an object has already been reserved using this name '$name' "
    if defined $self->{'reservations'}{$name};
  $self->{'object_number'}++;
  $self->{'reservations'}{$name} = [ $self->{'object_number'},
				     $self->{'generation_number'},
				     $type
				   ];
  [ $self->{'object_number'}, $self->{'generation_number'} ];
}

sub add_version {
  my $self = shift;
  $self->debug("adding version");
  $self->add("%PDF-" . $self->{'version'});
  $self->cr;
}

sub add_comment {
  my $self = shift;
  my $comment = shift || '';
  $self->debug("adding comment");
  $self->add("%" . $comment);
  $self->cr;
}

sub encode {
  my $type = shift;
  my $val = shift;
  ($type eq 'null' || $type eq 'number') && do {
    1; # do nothing
  } || $type eq 'cr' && do {
    $val = "\n";
  } || $type eq 'boolean' && do {
    $val = $val eq 'true' ? $val : $val eq 'false' ? $val :
    $val eq '0' ? 'false' : 'true';
  } || $type eq 'string' && do {
    $val = "($val)"; # TODO: split it. Quote parentheses.
  } || $type eq 'name' && do {
    $val = "/$val";
  } || $type eq 'array' && do {
    my $s = '[';
    for my $v (@$val) {
      $s .= &encode($$v[0], $$v[1]) . " ";
    }
    chop $s; # remove the trailing space
    $val = $s . "]";
  } || $type eq 'dictionary' && do {
    my $s = '<<' . &encode('cr');
    for my $v (keys %$val) {
      $s .= &encode('name', $v) . " ";
      $s .= &encode(${$$val{$v}}[0], ${$$val{$v}}[1]);#  . " ";
      $s .= &encode('cr');
    }
    $val = $s . ">>";
  } || $type eq 'object' && do {
    my $s = &encode('number', $$val[0]) . " " .
      &encode('number', $$val[1]) . " obj";
    $s .= &encode('cr');
    $s .= &encode($$val[2][0], $$val[2][1]);#  . " ";
    $s .= &encode('cr');
    $val = $s . "endobj";
  } || $type eq 'ref' && do {
    my $s = &encode('number', $$val[0]) . " " .
      &encode('number', $$val[1]) . " R";
    $val = $s;
  } || $type eq 'stream' && do {
    my $data = delete $$val{'Data'};
    my $s = '<<' . &encode('cr');
    for my $v (keys %$val) {
      $s .= &encode('name', $v) . " ";
      $s .= &encode(${$$val{$v}}[0], ${$$val{$v}}[1]);#  . " ";
      $s .= &encode('cr');
    }
    $s .= ">>" . &encode('cr') . "stream" . &encode('cr');
    $s .= $data . &encode('cr');
    $val = $s . "endstream" . &encode('cr');
  } || die "Error: unknown type '$type'";
  # TODO: add type 'text';
  $val;
}

sub add_object {
  my $self = shift;
  my $v = shift;

  my $val = &encode(@$v);
  $self->add($val);
  $self->cr;
  [ $$v[1][0], $$v[1][1] ];
}

sub null {
  my $self = shift;
  [ 'null', 'null' ];
}

sub boolean {
  my $self = shift;
  my $val = shift;
  [ 'boolean', $val ];
}

sub number {
  my $self = shift;
  my $val = shift;
  [ 'number', $val ];
}

sub name {
  my $self = shift;
  my $val = shift;
  [ 'name', $val ];
}

sub string {
  my $self = shift;
  my $val = shift;
  [ 'string', $val ];
}

sub array {
  my $self = shift;
  [ 'array', [ @_ ] ];
}

sub dictionary {
  my $self = shift;
  [ 'dictionary', { @_ } ];
}

sub indirect_obj {
  my $self = shift;
  my ($id, $gen);
  my $name = $_[1];
  my $type = $_[0][1]{'Type'}[1]
    if defined $_[0][1] && ref $_[0][1] eq 'HASH' && defined $_[0][1]{'Type'};
  if (defined $name && defined $self->{'reservations'}{$name}) {
    ($id, $gen) = @{$self->{'reservations'}{$name}};
    delete $self->{'reservations'}{$name};
  }
  elsif (defined $type && defined $self->{'reservations'}{$type}) {
    ($id, $gen) = @{$self->{'reservations'}{$type}};
    delete $self->{'reservations'}{$type};
  }
  else {
    $id = ++$self->{'object_number'};
    $gen = $self->{'generation_number'};
  }
  push @{$self->{'crossrefsubsection'}{$gen}}, [ $id, $self->position, 1 ];
  [ 'object', [ $id, $gen, @_ ] ];
}

sub indirect_ref {
  my $self = shift;
  [ 'ref', [ @_ ] ];
}

sub stream {
  my $self = shift;
  [ 'stream', { @_ } ];
}

sub add_info {
  my $self = shift;

  my %params = @_;
  $params{'Author'}   = $self->{'Author'}   if defined $self->{'Author'};
  $params{'Creator'}  = $self->{'Creator'}  if defined $self->{'Creator'};
  $params{'Title'}    = $self->{'Title'}    if defined $self->{'Title'};
  $params{'Subject'}  = $self->{'Subject'}  if defined $self->{'Subject'};
  $params{'Keywords'} = $self->{'Keywords'} if defined $self->{'Keywords'};

  $self->{'info'} = $self->reserve('Info');
  my $content = { 'Producer' => $self->string("PDF::Create version $VERSION"),
		  'Type'     => $self->name('Info') };
  $$content{'Author'} = $self->string($params{'Author'})
    if defined $params{'Author'};
  $$content{'Creator'} = $self->string($params{'Creator'})
    if defined $params{'Creator'};
  $$content{'Title'} = $self->string($params{'Title'})
    if defined $params{'Title'};
  $$content{'Subject'} = $self->string($params{'Subject'})
    if defined $params{'Subject'};
  $$content{'Keywords'} = $self->string($params{'Keywords'})
    if defined $params{'Keywords'};

  $self->add_object(
    $self->indirect_obj(
      $self->dictionary(%$content)), 'Info');
  $self->cr;
}

# Catalog specification.
sub add_catalog {
  my $self = shift;

  my %params = %{$self->{'catalog'}};
  # Type (mandatory)
  $self->{'catalog'} = $self->reserve('Catalog');
  my $content = { 'Type' => $self->name('Catalog') };
  # Pages (mandatory) [indirected reference]
  my $pages = $self->reserve('Pages');
  $$content{'Pages'} = $self->indirect_ref(@$pages);
  $self->{'pages'}{'id'} = $$content{'Pages'}[1];
  # Outlines [indirected reference]
  $$content{'Outlines'} = $self->indirect_ref(@{$self->{'outlines'}->{'id'}})
    if defined $self->{'outlines'};
  # PageMode
  $$content{'PageMode'} = $self->name($params{'PageMode'})
    if defined $params{'PageMode'};

  $self->add_object(
    $self->indirect_obj(
      $self->dictionary(%$content)));
  $self->cr;
}

sub add_outlines {
  my $self = shift;

  my %params = @_;
  my $outlines = $self->reserve("Outlines");

  my ($First, $Last);
  my @list = $self->{'outlines'}->list;
  my $i = -1;
  for my $outline (@list) {
    $i++;
    my $name = $outline->{'name'};
    $First = $outline->{'id'} unless defined $First;
    $Last =  $outline->{'id'};
    my $content = { 'Title' => $self->string($outline->{'Title'}) };
    if (defined $outline->{'Kids'} && scalar @{$outline->{'Kids'}}) {
      my $t = $outline->{'Kids'};
      $$content{'First'} = $self->indirect_ref(@{$$t[0]->{'id'}});
      $$content{'Last'} = $self->indirect_ref(@{$$t[$#$t]->{'id'}});
    }
    my $brothers = $outline->{'Parent'}->{'Kids'};
    my $j = -1;
    for my $brother (@$brothers) {
      $j++;
      last if $brother == $outline;
    }
    $$content{'Next'} = $self->indirect_ref(@{$$brothers[$j + 1]->{'id'}})
      if $j < $#$brothers;
    $$content{'Prev'} = $self->indirect_ref(@{$$brothers[$j - 1]->{'id'}})
      if $j;
    $outline->{'Parent'}->{'id'} = $outlines
      unless defined $outline->{'Parent'}->{'id'};
    $$content{'Parent'} = $self->indirect_ref(@{$outline->{'Parent'}->{'id'}});
    $$content{'Dest'} =
      $self->array($self->indirect_ref(@{$outline->{'Dest'}->{'id'}}),
		   $self->name('Fit'), $self->null, $self->null, $self->null);
    my $count = $outline->count;
    $$content{'Count'} = $self->number($count) if $count;
    my $t = $self->add_object(
      $self->indirect_obj(
        $self->dictionary(%$content), $name));
    $self->cr;
  }

  # Type (required)
  my $content = { 'Type' => $self->name('Outlines') };
  # Count
  my $count = $self->{'outlines'}->count;
  $$content{'Count'} = $self->number($count) if $count;
  $$content{'First'} = $self->indirect_ref(@$First);
  $$content{'Last'}  = $self->indirect_ref(@$Last);
  $self->add_object(
    $self->indirect_obj(
      $self->dictionary(%$content)));
  $self->cr;
}

sub new_outline {
  my $self = shift;

  my %params = @_;
  unless (defined $self->{'outlines'}) {
    $self->{'outlines'} = new PDF::Create::Outline();
    $self->{'outlines'}->{'pdf'} = $self; # circular reference
    $self->{'outlines'}->{'Status'} = 'opened';
  }
  my $parent = $params{'Parent'} || $self->{'outlines'};
  my $name   = "Outline " . ++$self->{'outline_count'};
  $params{'Destination'} = $self->{'current_page'}
    unless defined $params{'Destination'};
  my $outline = $parent->add($self->reserve($name, "Outline"), $name, %params);
  $outline;
}

sub new_page {
  my $self = shift;

  my %params = @_;
  my $parent = $params{'Parent'} || $self->{'pages'};
  my $name = "Page " . ++$self->{'page_count'};
  my $page = $parent->add($self->reserve($name, "Page"), $name);
  $page->{'resources'} = $params{'Resources'} if defined $params{'Resources'};
  $page->{'mediabox'}  = $params{'MediaBox'}  if defined $params{'MediaBox'};
  $page->{'cropbox'}   = $params{'CropBox'}   if defined $params{'CropBox'};
  $page->{'artbox'}    = $params{'ArtBox'}    if defined $params{'ArtBox'};
  $page->{'trimbox'}   = $params{'TrimBox'}   if defined $params{'TrimBox'};
  $page->{'bleedbox'}  = $params{'BleedBox'}  if defined $params{'BleedBox'};
  $page->{'rotate'}    = $params{'Rotate'}    if defined $params{'Rotate'};

  $self->{'current_page'} = $page;
  $page;
}

sub add_pages {
  my $self = shift;

  # $self->page_stream;
  my %params = @_;
  # Type (required)
  my $content = { 'Type' => $self->name('Pages') };
  # Kids (required)
  my $t = $self->{'pages'}->kids;
  die "Error: document MUST contains at least one page. Abort."
    unless scalar @$t;
  my $kids = [];
  map { push @$kids, $self->indirect_ref(@$_) } @$t;
  $$content{'Kids'} = $self->array(@$kids);
  $$content{'Count'} = $self->number($self->{'pages'}->count);
  $self->add_object(
    $self->indirect_obj(
      $self->dictionary(%$content)));
  $self->cr;

  for my $font (sort keys %{$self->{'fonts'}}) {
    $self->{'fontobj'}{$font} = $self->reserve('Font');
    $self->add_object(
      $self->indirect_obj(
        $self->dictionary(%{$self->{'fonts'}{$font}}), 'Font'));
    $self->cr;
  }

  for my $page ($self->{'pages'}->list) {
    my $name = $page->{'name'};
    my $type = 'Page' .
      (defined $page->{'Kids'} && scalar @{$page->{'Kids'}} ? 's' : '');
    # Type (required)
    my $content = { 'Type' => $self->name($type) };
    # Resources (required, may be inherited). See page 195.
    my $resources = {};
    for my $k (keys %{$page->{'resources'}}) {
      my $v = $page->{'resources'}{$k};
      ($k eq 'ProcSet') && do {
	my $l = [];
	if (ref($v) eq 'ARRAY') {
	  map { push @$l, $self->name($_) } @$v;
	}
	else {
	  push @$l, $self->name($v);
	}
	$$resources{'ProcSet'} = $self->array(@$l);
      } ||
      ($k eq 'fonts') && do {
	my $l = {};
	map {
	  $$l{"F$_"} = $self->indirect_ref(@{$self->{'fontobj'}{$_}});
	} keys %{$page->{'resources'}{'fonts'}};
	$$resources{'Font'} = $self->dictionary(%$l);
      };
    }
    $$content{'Resources'} = $self->dictionary(%$resources)
      if scalar keys %$resources;
    for my $K ('MediaBox', 'CropBox', 'ArtBox', 'TrimBox', 'BleedBox') {
      my $k = lc $K;
      if (defined $page->{$k}) {
	my $l = [];
	map { push @$l, $self->number($_) } @{$page->{$k}};
	$$content{$K} = $self->array(@$l);
      }
    }
    $$content{'Rotate'} = $page->{'rotate'} if defined $page->{'rotate'};
    if ($type eq 'Page') {
      $$content{'Parent'} = $self->indirect_ref(@{$page->{'Parent'}{'id'}});
      # Content
      if (defined $page->{'contents'}) {
	my $contents = [];
	map {
	  push @$contents, $self->indirect_ref(@$_);
	} @{$page->{'contents'}};
	$$content{'Contents'} = $self->array(@$contents);
      }
    }
    else {
      my $kids = [];
      map { push @$kids, $self->indirect_ref(@$_) } @{$page->kids};
      $$content{'Kids'} = $self->array(@$kids);
      $$content{'Parent'} = $self->indirect_ref(@{$page->{'Parent'}{'id'}})
	if defined $page->{'Parent'};
      $$content{'Count'} = $self->number($page->count);
    }
    $self->add_object(
      $self->indirect_obj(
        $self->dictionary(%$content), $name));
    $self->cr;
  }
}

sub add_crossrefsection {
  my $self = shift;

  $self->debug("adding cross reference section");
  # <cross-reference section> ::=
  #   xref
  #   <cross-reference subsection>+
  $self->{'crossrefstartpoint'} = $self->position;
  $self->add('xref');
  $self->cr;
  die "Fatal error: should contains at least one cross reference subsection."
    unless defined $self->{'crossrefsubsection'};
  for my $subsection (sort keys %{$self->{'crossrefsubsection'}}) {
    $self->add_crossrefsubsection($subsection);
  }
}

sub add_crossrefsubsection {
  my $self = shift;
  my $subsection = shift;

  $self->debug("adding cross reference subsection");
  # <cross-reference subsection> ::=
  #   <object number of first entry in subsection>
  #   <number of entries in subsection>
  #   <cross-reference entry>+
  #
  # <cross-reference entry> ::= <in-use entry> | <free entry>
  #
  # <in-use entry> ::= <byte offset> <generation number> n <end-of-line>
  #
  # <end-of-line> ::= <space> <carriage return>
  #   | <space> <linefeed>
  #   | <carriage return> <linefeed>
  #
  # <free entry> ::=
  #   <object number of next free object>
  #   <generation number> f <end-of-line>

  $self->add(0, ' ',
    1 + scalar @{$self->{'crossrefsubsection'}{$subsection}});
  $self->cr;
  $self->add(sprintf "%010d %05d %s ", 0, 65535, 'f');
  $self->cr;
  for my $entry (sort { $$a[0] <=> $$b[0] }
		 @{$self->{'crossrefsubsection'}{$subsection}}) {
    $self->add(sprintf "%010d %05d %s ", $$entry[1], $subsection,
	      $$entry[2] ? 'n' : 'f');
    # printf "%010d %010x %05d n\n", $$entry[1], $$entry[1], $subsection;
    $self->cr;
  }

}

sub add_trailer {
  my $self = shift;
  $self->debug("adding trailer");

  # <trailer> ::= trailer
  #   <<
  #   <trailer key value pair>+
  #   >>
  #   startxref
  #   <cross-reference table start address>
  #   %%EOF

  my @keys = (
     'Size',    # integer (required)
     'Prev',    # integer (req only if more than one cross-ref section)
     'Root',    # dictionary (required)
     'Info',    # dictionary (optional)
     'ID',      # array (optional) (PDF 1.1)
     'Encrypt'  # dictionary (req if encrypted) (PDF 1.1)
  );

  # TODO: should check for required fields
  $self->add('trailer');
  $self->cr;
  $self->add('<<');
  $self->cr;
  $self->{'trailer'}{'Size'} = 1;
  map {
    $self->{'trailer'}{'Size'} += scalar @{$self->{'crossrefsubsection'}{$_}}
  } keys %{$self->{'crossrefsubsection'}};
  $self->{'trailer'}{'Root'} =
    &encode(@{$self->indirect_ref(@{$self->{'catalog'}})});
  $self->{'trailer'}{'Info'} =
    &encode(@{$self->indirect_ref(@{$self->{'info'}})})
      if defined $self->{'info'};
  for my $k (@keys) {
    next unless defined $self->{'trailer'}{$k};
    $self->add("/$k ", ref $self->{'trailer'}{$k} eq 'ARRAY' ?
	       join(' ', @{$self->{'trailer'}{$k}}) : $self->{'trailer'}{$k});
    $self->cr;
  }
  $self->add('>>');
  $self->cr;
  $self->add('startxref');
  $self->cr;
  $self->add($self->{'crossrefstartpoint'});
  $self->cr;
  $self->add('%%EOF');
  $self->cr;
}

sub cr {
  my $self = shift;
  # $self->debug("adding CR");
  $self->add(&encode('cr'));
}

sub page_stream {
  my $self = shift;
  my $page = shift;
  if (defined $self->{'reservations'}{'stream_length'}) {
    ## If it is the same page, use the same stream.
    $self->cr, return if defined $page && defined $self->{'stream_page'} &&
      $page == $self->{'current_page'} && $self->{'stream_page'} == $page;
    # Remember the position
    my $len = $self->position - $self->{'stream_pos'} + 1;
    # Close the stream and the object
    $self->cr;
    $self->add('endstream');
    $self->cr;
    $self->add('endobj');
    $self->cr;
    $self->cr;
    # Add the length
    $self->add_object(
      $self->indirect_obj(
        $self->number($len), 'stream_length'));
    $self->cr;
  }
  # open a new stream if needed
  if (defined $page) {
    # get an object id for the stream
    my $obj = $self->reserve('stream');
    # release it
    delete $self->{'reservations'}{'stream'};
    # get another one for the length of this stream
    my $stream_length = $self->reserve('stream_length');
    push @$stream_length, 'R';
    push @{$page->{'contents'}}, $obj;
    # write the beginning of the object
    push @{$self->{'crossrefsubsection'}{$$obj[1]}},
      [ $$obj[0], $self->position, 1 ];
    $self->add("$$obj[0] $$obj[1] obj");
    $self->cr;
    $self->add('<<');
    $self->cr;
    $self->add('/Length ', join (' ', @$stream_length));
    $self->cr;
    $self->add('>>');
    $self->cr;
    $self->add('stream');
    $self->cr;
    $self->{'stream_pos'} = $self->position;
    $self->{'stream_page'} = $self->{'current_page'};
  }
}

sub font {
  my $self = shift;

  my %params = @_;
  my $num = 1 + scalar keys %{$self->{'fonts'}};
  $self->{'fonts'}{$num} = {
     'Subtype'  => $self->name($params{'Subtype'}  || 'Type1'),
     'Encoding' => $self->name($params{'Encoding'} || 'WinAnsiEncoding'),
     'BaseFont' => $self->name($params{'BaseFont'} || 'Helvetica'),
     'Name'     => $self->name("F$num"),
     'Type'     => $self->name("Font"),
  };
  $num;
}

sub uses_font {
  my $self = shift;
  my $page = shift;
  my $font = shift;

  $page->{'resources'}{'fonts'}{$font} = 1;
  $page->{'resources'}{'ProcSet'} = [ 'PDF', 'Text' ];
  $self->{'fontobj'}{$font} = 1;
}

1;

=head1 NAME

PDF::Create - create PDF files

=head1 SYNOPSIS

    use PDF::Create;

    my $pdf = new PDF::Create('filename' => 'mypdf.pdf',
			      'Version'  => 1.2,
			      'PageMode' => 'UseOutlines',
			      'Author'   => 'Fabien Tassin',
			      'Title'    => 'My title',
			 );
    my $root = $pdf->new_page('MediaBox' => [ 0, 0, 612, 792 ]);

    # Add a page which inherits its attributes from $root
    my $page = $root->new_page;

    # Prepare 2 fonts
    my $f1 = $pdf->font('Subtype'  => 'Type1',
 	   	        'Encoding' => 'WinAnsiEncoding',
 		        'BaseFont' => 'Helvetica');
    my $f2 = $pdf->font('Subtype'  => 'Type1',
 		        'Encoding' => 'WinAnsiEncoding',
 		        'BaseFont' => 'Helvetica-Bold');

    # Prepare a Table of Content
    my $toc = $pdf->new_outline('Title' => 'Document',
                                'Destination' => $page);
    $toc->new_outline('Title' => 'Section 1');
    my $s2 = $toc->new_outline('Title' => 'Section 2',
                               'Status' => 'closed');
    $s2->new_outline('Title' => 'Subsection 1');

    $page->stringc($f2, 40, 306, 426, "PDF::Create");
    $page->stringc($f1, 20, 306, 396, "version $PDF::Create::VERSION");

    # Add another page
    my $page2 = $root->new_page;
    $page2->line(0, 0, 612, 792);
    $page2->line(0, 792, 612, 0);

    $toc->new_outline('Title' => 'Section 3');
    $pdf->new_outline('Title' => 'Summary');

    # Add something to the first page
    $page->stringc($f1, 20, 306, 300,
                   'by Fabien Tassin <fta@oleane.net>');

    # Add the missing PDF objects and a the footer then close the file
    $pdf->close;

=head1 DESCRIPTION

PDF::Create allows you to create PDF documents using a large number
of primitives, and emit the result as a PDF file or stream.
PDF stands for Portable Document Format.

Documents can have several pages, a table of content, an information
section and many other PDF elements. More functionnalities will be
added as needs arise.

Documents are constructed on the fly so the memory footprint is not
tied to the size of the pages but only to their number.

=head1 Methods

=over 5

=item C<new>

To create a new PDF, send a new() message to the PDF::Create class.
For example:

	my $pdf = new PDF::Create;

This will create an empty PDF structure. A lot of attributes can be
used:

  - filename: destination file that will contain the resulting
    PDF or ...

  - fh: ... an already opened filehandle

  - Version: can be 1.0 to 1.3 (default: 1.2)

  - PageMode: how the document should appear when opened.
    Allowed values are:

     - UseNone: Open document with neither outline nor thumbnails
       visible. This is the default value.

     - UseOutlines: Open document with outline visible.

     - UseThumbs: Open document with thumbnails visible.

     - FullScreen: Open document in full-screen mode. In
       full-screen mode, there is no menu bar, window controls,
       nor any other window present.

  - Author: the name of the person who created this document

  - Creator: if the document was converted into a PDF document
    from another form, this is the name of the application that
    created the original document.

  - Title: the title of the document

  - Subject: the subject of the document

  - Keywords: keywords associated with the document

Example:

        my $pdf = new PDF::Create('filename' => 'mypdf.pdf',
                                  'Version'  => 1.2,
                                  'PageMode' => 'UseOutlines',
                                  'Author'   => 'Fabien Tassin',
                                  'Title'    => 'My title',
                             );

The created object is returned.

=item C<close>

Add the missing sections needed to obtain a complete and valid PDF
document then close the file if needed.

=item C<add_comment [string]>

Add a comment to the document.

=item C<new_outline [parameters]>

Add an outline to the document using the given parameters.
Return the newly created outline.

Parameters can be:

- Title: the title of the outline. Mandatory.

- Destination: the destination of this outline. In this version, it is
only possible to give a page as destination. The default destination is
the current page.

- Parent: the parent of this outline in the outlines tree. This is an
outline object.

Example:

          my $outline = $pdf->new_outline('Title' => 'Item 1',
                                          'Destination' => $page);
          $outline->new_outline('Title' => 'Item 1.1');
          $pdf->new_outline('Title' => 'Item 1.2',
                            'Parent' => $outline);
          $pdf->new_outline('Title' => 'Item 2');


=item C<new_page>

Add a page to the document using the given parameters.
Return the newly created page.

Parameters can be:

- Parent: the parent of this page in the pages tree. This is a
page object.

- Resources: Resources required by this page.

- MediaBox: Rectangle specifying the natural size of the page,
for example the dimensions of an A4 sheet of paper. The coordinates
are measured in default user space units. It must be the reference
of a 4 values array.

- CropBox: Rectangle specifying the default clipping region for
the page when displayed or printed. The default is the value of
the MediaBox.

- ArtBox: Rectangle specifying an area of the page to be used when
placing PDF content into another application. The default is the value
of the CropBox. [PDF 1.3]

- TrimBox: Rectangle specifying the intended finished size
of the page (for example, the dimensions of an A4 sheet of paper).
In some cases, the MediaBox will be a larger rectangle, which includes
printing instructions, cut marks, or other content. The default is
the value of the CropBox. [PDF 1.3].

- BleedBox: Rectangle specifying the region to which all page
content should be clipped if the page is being output in a production
environment. In such environments, a bleed area is desired, to
accommodate physical limitations of cutting, folding, and trimming
equipment. The actual printed page may include printer's marks that
fall outside the bleed box. The default is the value of the CropBox.
[PDF 1.3]

- Rotate: Specifies the number of degrees the page should be rotated
clockwise when it is displayed or printed. This value must be zero
(the default) or a multiple of 90.

=item C<font>

Prepare a font using the given arguments. This font will be added
to the document only if it is used at least once before the close method
is called.

Parameters can be:

- Subtype: Type of font. PDF defines some types of fonts. It must be
one of the predefined type Type1, Type3, TrueType or Type0.

In this version, only Type1 is supported. This is the default value.

- Encoding: Specifies the encoding from which the new encoding differs.
It must be one of the predefined encodings MacRomanEncoding,
MacExpertEncoding or WinAnsiEncoding.

In this version, only WinAnsiEncoding is supported. This is the default
value.

- BaseFont: The PostScript name of the font. It can be one of the following
base font: Courier, Courier-Bold, Courier-BoldOblique, Courier-Oblique,
Helvetica, Helvetica-Bold, Helvetica-BoldOblique, Helvetica-Oblique,
Times-Roman, Times-Bold, Times-Italic, Times-BoldItalic, Symbol or
ZapfDingbats. All of them are supported in this version except the last two
ones.

The default value is Helvetica.

=head2 Page methods

This section describes the methods that can be used by a PDF::Create::Page
object.

In its current form, this class is divided into two main parts, one for
drawing (using PostScript like paths) and one for writing.

Some methods are not described here because they must not be called
directly (e.g. C<new> and C<add>).

=item C<new_page params>

Add a sub-page to the current page.

See C<PDF::Create::new_page>

=item C<string font size x y text>

Add text to the current page using the font object at the given size and
position. The point (x, y) is the bottom left corner of the rectangle
containing the text.

Example :

    my $f1 = $pdf->font('Subtype'  => 'Type1',
 	   	        'Encoding' => 'WinAnsiEncoding',
 		        'BaseFont' => 'Helvetica');
    $page->string($f1, 20, 306, 396, "some text");

=item C<stringl font size x y text>

Same as C<string>.

=item C<stringr font size x y text>

Same as C<string> but right aligned.

=item C<stringc font size x y text>

Same as C<string> but centered.

=item C<string_width font text>

Return the size of the text using the given font in default user space units.
This does not contain the size of the font yet.

=item C<line x1 y1 x2 y2>

Draw a line between (x1, y1) and (x2, y2).

=head2 Low level drawing methods

=item C<moveto x y>

Moves the current point to (x, y), omitting any connecting line segment.

=item C<lineto x y>

Appends a straight line segment from the current point to (x, y).
The current point is (x, y).

=item C<curveto x1 y1 x2 y2 x3 y3>

Appends a Bezier curve to the path. The curve extends from the current
point to (x3 ,y3) using (x1 ,y1) and (x2 ,y2) as the Bezier control
points. The new current point is (x3 ,y3).

=item C<rectangle x y w h>

Adds a rectangle to the current path.

=item C<closepath>

Closes the current subpath by appending a straight line segment
from the current point to the starting point of the subpath.

=item C<newpath>

Ends the path without filling or stroking it.

=item C<stroke>

Strokes the path.

=item C<closestroke>

Closes and strokes the path.

=item C<fill>

Fills the path using the non-zero winding number rule.

=item C<fill2>

Fills the path using the even-odd rule

=back

=head1 SEE ALSO

L<PDF::Create::Page(3)>, L<perl(1)>

=head1 AUTHOR

Fabien Tassin (fta@oleane.net)

=head1 COPYRIGHT

Copyright 1999, Fabien Tassin. All rights reserved.
It may be used and modified freely, but I do request that
this copyright notice remain attached to the file. You may
modify this module as you wish, but if you redistribute a
modified version, please attach a note listing the modifications
you have made.

=cut
