import json

notebook = {
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# Exploratory Data Analysis (EDA) on Payment Failure Dataset\n",
    "\n",
    "## 1. Load dataset"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "import pandas as pd\n",
    "import numpy as np\n",
    "import matplotlib.pyplot as plt\n",
    "import seaborn as sns\n",
    "\n",
    "# Assuming the notebook is saved in ml/notebooks/\n",
    "# We use '../data/' to go up one directory and into the data folder\n",
    "file_path = '../data/payment_failure_dataset.csv'\n",
    "df = pd.read_csv(file_path)\n",
    "\n",
    "print(\"Dataset loaded successfully.\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 2. First 5 rows"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Display the first 5 rows to verify the data loaded correctly\n",
    "df.head()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 3. Dataset shape"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "print(f\"Total Rows: {df.shape[0]}\")\n",
    "print(f\"Total Columns: {df.shape[1]}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 4. Column names and data types"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# This will show us which columns are numbers (int64/float64) and which are text (object)\n",
    "df.info()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 5. Missing values\n",
    "## 6. Duplicate payment IDs\n",
    "## 7. Duplicate rows"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "print(\"--- Missing Values ---\")\n",
    "print(df.isnull().sum())\n",
    "\n",
    "print(\"\\n--- Duplicate Payment IDs ---\")\n",
    "print(df['payment_id'].duplicated().sum())\n",
    "\n",
    "print(\"\\n--- Duplicate Rows ---\")\n",
    "print(df.duplicated().sum())"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 8. Descriptive statistics"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Summary statistics for all numerical columns\n",
    "df.describe().round(2)"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 9. Target distribution\n",
    "Checking the counts and percentages of successful payments (0) vs. failed payments (1)."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "target_counts = df['payment_failed'].value_counts()\n",
    "target_pct = df['payment_failed'].value_counts(normalize=True) * 100\n",
    "\n",
    "print(\"Target Counts:\")\n",
    "print(target_counts)\n",
    "\n",
    "print(\"\\nTarget Percentages (%):\")\n",
    "print(target_pct.round(2))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 10. Failure rate by payment method\n",
    "## 11. Failure rate by retry count\n",
    "## 12. Failure rate by subscription status\n",
    "\n",
    "By calculating the mean of the `payment_failed` column (which contains only 0s and 1s), we get the exact failure probability for each category."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "print(\"--- Failure Rate by Payment Method (%) ---\")\n",
    "print((df.groupby('payment_method')['payment_failed'].mean() * 100).round(2))\n",
    "\n",
    "print(\"\\n--- Failure Rate by Retry Count (%) ---\")\n",
    "print((df.groupby('retry_count')['payment_failed'].mean() * 100).round(2))\n",
    "\n",
    "print(\"\\n--- Failure Rate by Subscription Status (%) ---\")\n",
    "print((df.groupby('subscription_status')['payment_failed'].mean() * 100).round(2))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 13. Failure rate by historical success rate\n",
    "## 14. Failure rate by amount ranges\n",
    "\n",
    "Because success rate and amount are continuous numbers, we will group them into \"bins\" (ranges) to see how the failure rate changes across different levels."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Create temporary bins for historical success rate\n",
    "df['success_rate_bin'] = pd.cut(df['historical_success_rate'], bins=[0.0, 0.5, 0.8, 0.9, 0.95, 1.0])\n",
    "print(\"--- Failure Rate by Historical Success Rate Bins (%) ---\")\n",
    "print((df.groupby('success_rate_bin', observed=False)['payment_failed'].mean() * 100).round(2))\n",
    "\n",
    "# Create temporary bins for transaction amount\n",
    "df['amount_bin'] = pd.cut(df['amount'], bins=[0, 50, 250, 1000, 5000])\n",
    "print(\"\\n--- Failure Rate by Amount Ranges (%) ---\")\n",
    "print((df.groupby('amount_bin', observed=False)['payment_failed'].mean() * 100).round(2))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 15. Failure rate by hour\n",
    "## 16. Failure rate by transactions_last_24h"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "print(\"--- Failure Rate by Hour of Day (%) ---\")\n",
    "print((df.groupby('hour_of_day')['payment_failed'].mean() * 100).round(2))\n",
    "\n",
    "print(\"\\n--- Failure Rate by Transactions in Last 24h (%) ---\")\n",
    "print((df.groupby('transactions_last_24h')['payment_failed'].mean() * 100).round(2))"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 17. Useful visualizations\n",
    "Let's visualize the target distribution and the relationships between failure rate and our categorical features. Seaborn's `barplot` automatically calculates the mean (failure rate) for the y-axis."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": None,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Set the visual style for the charts\n",
    "sns.set_theme(style=\"whitegrid\")\n",
    "\n",
    "# Create a figure holding multiple subplots\n",
    "plt.figure(figsize=(16, 12))\n",
    "\n",
    "# 1. Target Distribution\n",
    "plt.subplot(2, 3, 1)\n",
    "sns.countplot(data=df, x='payment_failed', palette='pastel', hue='payment_failed', legend=False)\n",
    "plt.title('Target Distribution (0 = Success, 1 = Fail)')\n",
    "\n",
    "# 2. Failure Rate by Payment Method\n",
    "plt.subplot(2, 3, 2)\n",
    "sns.barplot(data=df, x='payment_method', y='payment_failed', palette='Set2', hue='payment_method', legend=False)\n",
    "plt.title('Failure Rate by Payment Method')\n",
    "plt.ylabel('Failure Probability')\n",
    "\n",
    "# 3. Failure Rate by Retry Count\n",
    "plt.subplot(2, 3, 3)\n",
    "sns.barplot(data=df, x='retry_count', y='payment_failed', palette='Set2', hue='retry_count', legend=False)\n",
    "plt.title('Failure Rate by Retry Count')\n",
    "plt.ylabel('Failure Probability')\n",
    "\n",
    "# 4. Failure Rate by Subscription Status\n",
    "plt.subplot(2, 3, 4)\n",
    "sns.barplot(data=df, x='subscription_status', y='payment_failed', palette='Set2', hue='subscription_status', legend=False)\n",
    "plt.title('Failure Rate by Subscription Status')\n",
    "plt.ylabel('Failure Probability')\n",
    "\n",
    "# 5. Failure Rate by Historical Success Rate Bins\n",
    "plt.subplot(2, 3, 5)\n",
    "sns.barplot(data=df, x='success_rate_bin', y='payment_failed', palette='Set2', hue='success_rate_bin', legend=False)\n",
    "plt.title('Failure Rate by Success Rate')\n",
    "plt.xticks(rotation=45) # Rotate labels so they don't overlap\n",
    "plt.ylabel('Failure Probability')\n",
    "\n",
    "# Clean up layout and display\n",
    "plt.tight_layout()\n",
    "plt.show()"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "Python 3",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.10.0"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}

with open('/Users/abirami/Desktop/RecoverAI/ml/notebooks/01_dataset_exploration.ipynb', 'w') as f:
    json.dump(notebook, f, indent=1)

