FROM beefproject/beef:latest
USER root
COPY config.yaml /beef/config.yaml
RUN sed -i 's/return false unless @ip.to_s.eql? request.ip/#return false unless @ip.to_s.eql? request.ip/g' /beef/extensions/admin_ui/classes/session.rb
USER beef
ENTRYPOINT ["/beef/beef"]
