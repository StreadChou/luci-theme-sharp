FROM scratch
ARG ROOTFS=openwrt-arm64.tar.gz
ADD .dev/cache/${ROOTFS} /
RUN mkdir -p /var/lock /var/run && \
    apk update && \
    apk add luci-base luci-mod-admin-full luci-theme-bootstrap luci-i18n-base-zh-cn uhttpd uhttpd-mod-ubus
COPY root/ /
COPY dev/entrypoint.sh /usr/local/bin/sharp-dev
RUN chmod +x /usr/local/bin/sharp-dev && \
    sh /etc/uci-defaults/30_luci-theme-sharp && \
    sh /etc/uci-defaults/31_luci-theme-sharp-languages && \
    uci set luci.main.lang=zh_cn && uci commit luci && \
    printf 'sharp-dev\nsharp-dev\n' | passwd root
EXPOSE 80
ENTRYPOINT ["/usr/local/bin/sharp-dev"]
