package XMLParse;

use strict;
use vars qw($VERSION @ISA @EXPORT @EXPORT_OK);

require Exporter;
require AutoLoader;

@ISA = qw(Exporter AutoLoader);

@EXPORT = qw();
$VERSION = '1.0';

sub new ($$ )
{
    my ($class, $xml) = @_;
    my $self = {
        'xml' => $xml,
        'pos' => 0,
        'attrs' => { },
    };
    bless $self, $class;
    return $self;
}

sub next ($$ )
{
    my ($self) = @_;
    my $xml = $self->{'xml'};
    pos $xml = $self->{'pos'};
    $xml =~ m{
        (< \s*
         (/?[\w-]+/?)
         ( (?: (?: \s+\w+ \s* = \s* "[^\"]*") | # quoted attrs
               (?: \s+\w+ \s* =[^>\"]) | # attrs w/ no quotes
               (?: \s+\w+) # attrs with no value
             ) * ) \s*         
         /? >)}sgix;

    return undef if (! $1);

    my %attrs = ();
    my ($match, $tag, $attrs) = ($1, $2, $3);
    $self->{'pos'} = pos $xml;
    while ($attrs =~ m{
        (?: \s+ (\w+) \s* = \s* "([^\"]*)") | # quoted attrs
        (?: \s+ (\w+) \s* = ([^>\"])) | # attrs w/ no quotes
        (?: \s+ (\w+) ) # attrs with no value
        }sgix )
    {
        if ($1) {
            $attrs {$1} = $2;
        } elsif ($3) {
            $attrs {$3} = $4;
        } else {
            $attrs {$5} = undef;
        }
    }
    $self->{'attrs'} = \%attrs;
    return $tag;
}

1;

__END__

=head1 NAME

XMLParse - very simple XML Parser

=head1 SYNOPSIS

    use XMLParse;
$xmlp = new XMLParse ()

=head1 DESCRIPTION

XMLParse implements a very limited XML-style lexical-type parse.  It
doesn't check that tags are properly nested or attempt to ensure that
documents adhere to a DTD.  It doesn't handle entities.  It ignores
anything in between tags (CTYPE?).  It does return tags one at a time
storing their attributes in the attr hash.

=head1 AUTHOR

Michael Sokolov, sokolov@ifactory.com


