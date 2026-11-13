#!/bin/sh
set -eu
mkdir -p /var/run /var/lock /tmp/luci-sessions
cleanup() {
    kill ${http_pid:-} ${rpc_pid:-} ${procd_pid:-} ${bus_pid:-} 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM
/sbin/ubusd &
bus_pid=$!
attempt=0
until ubus list >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 10 ] || exit 1
    sleep 1
done
# Non-PID-1 procd exposes system RPC; no router boot/network scripts run.
/sbin/procd -S &
procd_pid=$!
/sbin/rpcd &
rpc_pid=$!
/usr/sbin/uhttpd -f -p 0.0.0.0:80 -h /www -x /cgi-bin -u /ubus -t 60 &
http_pid=$!
echo 'Sharp development server ready. Local account: root / sharp-dev'
wait "$http_pid"
