FROM beefproject/beef:latest
USER root
COPY config.yaml /beef/config.yaml
RUN chown beef:beef /beef/config.yaml
USER beef
ENTRYPOINT ["/beef/beef"]
