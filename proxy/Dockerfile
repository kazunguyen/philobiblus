FROM nginx:1.27-alpine

COPY default.conf.template /etc/nginx/templates/default.conf.template

ENV PORT=8080
ENV BACKEND_UPSTREAM="http://136.68.162.254"

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
