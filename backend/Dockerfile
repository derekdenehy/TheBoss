FROM python:3.12-slim

# System deps: fontconfig (with config + cache) so tectonic/LaTeX can load fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    fontconfig \
    fonts-liberation \
    libfontconfig1 \
    libssl-dev \
    ca-certificates \
    && fc-cache -fv \
    && rm -rf /var/lib/apt/lists/*

# Install tectonic (tarball contains usr/bin/tectonic, so extract then move to PATH)
RUN wget -qO /tmp/tectonic.tar.gz \
    https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz \
    && tar -xzf /tmp/tectonic.tar.gz -C /tmp \
    && mv /tmp/usr/bin/tectonic /usr/local/bin/tectonic \
    && chmod +x /usr/local/bin/tectonic \
    && rm -rf /tmp/tectonic.tar.gz /tmp/usr

ENV TECTONIC_PATH=/usr/local/bin/tectonic

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir pdfplumber

COPY . .

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
