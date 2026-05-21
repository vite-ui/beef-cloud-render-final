FROM beefproject/beef:latest
USER root
RUN sed -i 's/passwd: "beef"/passwd: "MyStrongPass123!"/g' /beef/config.yaml && sed -i 's/user: "beef"/user: "admin"/g' /beef/config.yaml
USER beef
ENTRYPOINT ["/beef/beef"]
