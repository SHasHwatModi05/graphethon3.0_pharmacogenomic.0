#!/usr/bin/env Rscript
# risk_chart.R — Generate pharmacogenomic risk distribution chart

args <- commandArgs(trailingOnly = TRUE)
input_path <- args[1]
output_path <- args[2]

if (!requireNamespace("jsonlite", quietly = TRUE)) install.packages("jsonlite", repos = "https://cran.r-project.org")

library(jsonlite)

data <- fromJSON(input_path)

if (length(data) == 0 || nrow(data) == 0) {
  png(output_path, width = 800, height = 500, bg = "#0f1117")
  plot.new()
  text(0.5, 0.5, "No analysis data", col = "#9ca3af", cex = 1.5)
  dev.off()
  quit(status = 0)
}

risk_colors <- c(
  "Safe" = "#10b981", "Adjust Dosage" = "#f59e0b",
  "Toxic" = "#ef4444", "Ineffective" = "#8b5cf6", "Unknown" = "#6b7280"
)

risk_counts <- table(data$risk_label)

png(output_path, width = 1200, height = 600, bg = "#0f1117")
par(mfrow = c(1, 2), bg = "#0f1117")

# Pie chart
pie_cols <- risk_colors[names(risk_counts)]
pie_cols[is.na(pie_cols)] <- "#6b7280"
pie(risk_counts, col = pie_cols, main = "Risk Distribution",
    col.main = "#f9fafb", labels = paste(names(risk_counts), "\n(", risk_counts, ")"),
    border = "#0f1117")

# Bar chart: drug vs risk
par(bg = "#1e2030", col.main = "#f9fafb", col.axis = "#9ca3af", col.lab = "#9ca3af")
drug_risk_map <- setNames(data$risk_label, data$drug)
bar_cols <- risk_colors[drug_risk_map]
bar_cols[is.na(bar_cols)] <- "#6b7280"

barplot(rep(1, length(drug_risk_map)),
        names.arg = names(drug_risk_map),
        col = bar_cols,
        main = "Drug Risk Profile",
        las = 2,
        border = NA,
        col.main = "#f9fafb")

dev.off()
cat("Risk chart saved to:", output_path, "\n")
