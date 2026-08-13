FROM nginx:alpine

# Copy static files
COPY . /usr/share/nginx/html

# Fix permissions inside the image
# -type d: Directories get 755 (drwxr-xr-x)
# -type f: Files get 644 (-rw-r--r--)
RUN find /usr/share/nginx/html -type d -exec chmod 755 {} + && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} +

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]