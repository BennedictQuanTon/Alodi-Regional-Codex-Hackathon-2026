#!/bin/sh
# Stock clips are not committed. Downloads the Mixkit Free License clips listed in CREDITS.md and cuts them to graded frames.
cd "$(dirname "$0")/assets/stock" || exit 1
cut_clip() { # name id start seconds
  [ -f "$1.mp4" ] || curl -sfL -o "$1.mp4" "https://assets.mixkit.co/videos/$2/$2-1080.mp4"
  mkdir -p "$1"
  ffmpeg -y -v error -ss "$3" -t "$4" -i "$1.mp4" -r 30 -vf "scale=1920:-2" -q:v 4 "$1/%04d.jpg"
}
cut_clip wheels 39917 1 7
cut_clip door 31155 0 6
cut_clip walk 31136 1 6
cut_clip rider 39920 0 5
cut_clip traffic 56 2 8
# Sound effects (Mixkit Sound Effects Free License), converted to wav next to the team's own
cd ../sfx || exit 1
get_sfx() { [ -f "mk-$1.wav" ] || { curl -sfL -o "/tmp/mk-$1.mp3" "https://assets.mixkit.co/active_storage/sfx/$2/$2-preview.mp3" && ffmpeg -y -v error -i "/tmp/mk-$1.mp3" -ar 44100 -ac 2 "mk-$1.wav"; rm -f "/tmp/mk-$1.mp3"; }; }
get_sfx whoosh 1490; get_sfx sweep 166; get_sfx slide 3120; get_sfx lightpop 3005; get_sfx msg 2354; get_sfx click 2577; get_sfx btn 2580; get_sfx ok 2867; get_sfx good 951; get_sfx select 2573; get_sfx logo 2903; get_sfx ring 1359; get_sfx fail 946; get_sfx lock 2858; get_sfx tick 2585
