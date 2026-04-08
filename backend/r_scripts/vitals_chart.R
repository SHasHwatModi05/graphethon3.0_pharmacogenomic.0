#!/usr/bin/env Rscript
# vitals_chart.R — Generate patient vitals trend charts
# Args: input_json_path output_png_path

args <- commandArgs(trailingOnly = TRUE)
if (length(args) < 2) {
  cat("Usage: Rscript vitals_chart.R input.json output.png\n")
  quit(status = 1)
}

input_path <- args[1]
output_path <- args[2]

# Install jsonlite if needed
if (!requireNamespace("jsonlite", quietly = TRUE)) install.packages("jsonlite", repos = "https://cran.r-project.org")
if (!requireNamespace("ggplot2", quietly = TRUE)) install.packages("ggplot2", repos = "https://cran.r-project.org")
if (!requireNamespace("tidyr", quietly = TRUE)) install.packages("tidyr", repos = "https://cran.r-project.org")

library(jsonlite)
library(ggplot2)
library(tidyr)

# Read data
data <- fromJSON(input_path)

if (nrow(data) == 0) {
  png(output_path, width = 1200, height = 600, bg = "#0f1117")
  plot.new()
  text(0.5, 0.5, "No vitals data available", col = "#9ca3af", cex = 1.5)
  dev.off()
  quit(status = 0)
}

# Parse timestamps
data$recorded_at <- as.POSIXct(data$recorded_at, format = "%Y-%m-%dT%H:%M:%S")
if (nrow(data) > 20) data <- tail(data, 20)

# Melt for plotting
vital_cols <- c("heart_rate", "systolic_bp", "diastolic_bp", "oxygen_saturation", "temperature")
labels <- c("Heart Rate (bpm)", "Systolic BP", "Diastolic BP", "SpO2 (%)", "Temp (°C)")
colors <- c("#ef4444", "#3b82f6", "#60a5fa", "#10b981", "#f59e0b")

png(output_path, width = 1400, height = 900, bg = "#0f1117")

par(mfrow = c(2, 3), bg = "#0f1117", col.main = "#f9fafb",
    col.lab = "#9ca3af", col.axis = "#9ca3af",
    mar = c(4, 4, 3, 1))

for (i in seq_along(vital_cols)) {
  col <- vital_cols[i]
  if (col %in% names(data) && !all(is.na(data[[col]]))) {
    plot(data$recorded_at, data[[col]],
         type = "l", col = colors[i], lwd = 2.5,
         main = labels[i], xlab = "Time", ylab = "",
         bg = "#1e2030", axes = TRUE,
         col.main = "#f9fafb", col.lab = "#9ca3af",
         panel.first = {
           rect(par("usr")[1], par("usr")[3], par("usr")[2], par("usr")[4],
                col = "#1e2030", border = NA)
           grid(col = "#374151", lty = 1)
         })
    points(data$recorded_at, data[[col]], col = colors[i], pch = 19, cex = 0.8)
  } else {
    plot.new()
    text(0.5, 0.5, paste("No", labels[i], "data"), col = "#6b7280")
  }
}

dev.off()
cat("Chart saved to:", output_path, "\n")
