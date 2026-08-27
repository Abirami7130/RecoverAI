import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer

def main():
    print("Step 5: Starting ML Data Preparation...\n")
    
    # 1. Load the dataset
    # Assuming the script is run from the ml/ directory or project root
    file_path = "ml/data/payment_failure_dataset.csv"
    try:
        df = pd.read_csv(file_path)
    except FileNotFoundError:
        # Fallback path if run directly from inside the src/ folder
        file_path = "../data/payment_failure_dataset.csv"
        df = pd.read_csv(file_path)
        
    print(f"Original dataset shape: {df.shape}")
    
    # 2. Define target and separate features
    target_col = 'payment_failed'
    
    # 3. Exclude identifiers (they do not help predict the future)
    drop_cols = ['payment_id', 'customer_id', target_col]
    
    # Create X (features) and y (target)
    X = df.drop(columns=drop_cols)
    y = df[target_col]
    
    print(f"X shape (features): {X.shape}")
    print(f"y shape (target): {y.shape}")
    
    # 4. Define numerical and categorical feature lists
    numerical_features = [
        'amount', 
        'retry_count', 
        'transactions_last_24h', 
        'time_since_last_payment_min', 
        'hour_of_day', 
        'day_of_week', 
        'customer_tenure_days', 
        'previous_payment_count', 
        'previous_failure_count', 
        'historical_success_rate'
    ]
    
    categorical_features = [
        'payment_method', 
        'subscription_status'
    ]
    
    print(f"\nNumerical features list: {numerical_features}")
    print(f"Categorical features list: {categorical_features}\n")
    
    # 6. Split the data into 80% training and 20% testing
    # stratify=y ensures both sets have the exact same percentage of failed payments
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, 
        test_size=0.2, 
        random_state=42, 
        stratify=y
    )
    
    print(f"Training shape (X_train): {X_train.shape}")
    print(f"Test shape (X_test): {X_test.shape}")
    
    # Calculate and print failure percentages
    train_fail_pct = y_train.mean() * 100
    test_fail_pct = y_test.mean() * 100
    print(f"Training failure percentage: {train_fail_pct:.2f}%")
    print(f"Test failure percentage: {test_fail_pct:.2f}%\n")
    
    # 7. Build the scikit-learn preprocessing pipeline
    # StandardScaler converts numbers to have a mean of 0 and standard deviation of 1
    numeric_transformer = StandardScaler()
    
    # OneHotEncoder converts text categories into binary (0 or 1) columns
    # handle_unknown='ignore' prevents errors if a new category appears later
    categorical_transformer = OneHotEncoder(handle_unknown='ignore')
    
    # ColumnTransformer applies the correct transformer to the correct columns
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numerical_features),
            ('cat', categorical_transformer, categorical_features)
        ]
    )
    
    # 8. Fit preprocessing ONLY on training data to prevent data leakage
    # Then transform both training and testing data
    print("Fitting preprocessing pipeline on training data...")
    X_train_processed = preprocessor.fit_transform(X_train)
    
    print("Transforming testing data...")
    X_test_processed = preprocessor.transform(X_test)
    
    print("\nData preparation complete. (No models trained, no files overwritten).")

if __name__ == "__main__":
    main()
