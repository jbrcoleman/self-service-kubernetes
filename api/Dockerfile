# Build stage
FROM golang:1.20-alpine AS build

# Install build dependencies
RUN apk add --no-cache git make gcc libc-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o provisioner-api .

# Install tools for Terraform
FROM alpine:3.18 AS tools

# Install Terraform and AWS CLI
RUN apk add --no-cache curl unzip bash \
    && curl -sSL https://releases.hashicorp.com/terraform/1.4.6/terraform_1.4.6_linux_amd64.zip -o terraform.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform.zip \
    && curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Final stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata jq curl git openssl openssh-client

# Copy Terraform and AWS CLI from tools stage
COPY --from=tools /usr/local/bin/terraform /usr/local/bin/terraform
COPY --from=tools /usr/local/aws-cli/ /usr/local/aws-cli/
RUN ln -s /usr/local/aws-cli/dist/aws /usr/local/bin/aws

# Create non-root user
RUN addgroup -g 1001 -S app && adduser -u 1001 -S app -G app

# Set working directory
WORKDIR /app

# Copy the binary from build stage
COPY --from=build /app/provisioner-api .

# Copy necessary files
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/configs ./configs
COPY --from=build /app/docs ./docs

# Copy terraform modules
COPY --from=build /app/provisioning ./provisioning

# Set environment variables
ENV TZ=UTC
ENV GIN_MODE=release
ENV CONFIG_PATH=/app/configs

# Expose port
EXPOSE 8080

# Switch to non-root user
USER app

# Set entry point
ENTRYPOINT ["./provisioner-api"]