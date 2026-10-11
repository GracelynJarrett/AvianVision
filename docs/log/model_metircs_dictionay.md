# About this document
This document contains a dictionary for the model's metrics. The dictionary explains what each metric represents and why it was recorded. At the end of the doc there is a table comparing the base model, chosen model, and registered model (chosen model + test set).


# Metric Dictionary

## Loss
    ** Definition:
        Measures how far the model's predictions are from the true label.
    ** Why:
        Loss is the value optimized during training, with lower values meaning the model is performing better.

## Accuracy
    ** Definition:
        The proportion of predictions that were classified correctly out of all predictions made.
    ** Why:
        Accuracy is one of the best metrics to look at when deciding to use the model or to continue experimenting with hypertuning.
    ** Formula:
                                Number of Correct Prdictions
                 Accuracy   =  -------------------------------
                                     Total Predictions


## Top-5 Accuracy
   ** Definition:
        Percentage of predictions where the correct class appears within the model's five highest-confidence predictions.
    ** Why:
        Top-5 accuracy demonstrates how close the model was to making the correct prediction.
    ** Formula:
                                true top 5 prediction class
            Top 5 Accuracy   =  -------------------------------
                                     Total Predictions


## Macro Precision
    ** Definition:
            Measures how often positive predictions are correct while giving equal importance to all classes
    ** Why:
        Macro allows the precision to be calculated independently for each class and then averaged into one precision value.
    ** Formula:
                                    True Positives
            Precision   =  ----------------------------------
                            True Positives + False Positives

## Macro Recall
    ** Definition:
            Measures the model's ability to identify all instances of each class
    ** Why:
            Macro calculates each class independently and then averages them across all the classes.
    ** Formula:
                                True Positives
            Recall  =  ----------------------------------
                        True Positives + False Negatives

## Macro F1 score
    ** Definition:
        Balances precision and recall into one metric
    ** Why:
        Macro allows for each class to get its own f1 score before taking the average
    ** Formula:
                            Precision X Recall
                F1  = 2 X  ----------------------
                             Precision + Recall
        

## Best Epoch
    ** Definition:
            The epoch that achieved the highest validation performance according to the selected evaluation metric.
    ** Why:
        Demonstrates where the model performed the best.
        

## Prefix Definitions
   |Prefix|Definition|
   |train_|Metric calculated using the training dataset|
   |val_|Metric calculated using the validation dataset|
   |test_|Metric calculated using the test dataset|
   |final_|Metric calculated from the final training epoch|
   |best_|Metric corresponding to the epoch with the best validation performance|
   
        
        


# Metric Table
|Metric|Type|Definition|Better Direction|
|Loss|Optimization|Measures prediction error used during training|Lower|
|Accuracy|Classification|Percentage of correctly classified samples|Higher|
|Top-5 Accuracy|Classification|Percentage of samples where the true class is among the top five predicted classes|Higher|
|Macro Precision|Classification|Average precision across all classes|Higher|
|Macro Recall|Classification|Average recall across all classes|Higher|
|Macro F1 Score|Classification|Harmonic mean of precision and recall averaged across classes|Higher|
|Best Epoch|Training|Epoch that achieved the best validation performance|N/A|





# Model table

| Model ID | Model Name | Best Epoch | Train Loss | Train Accuracy | Train Top-5 Accuracy | Validation Loss | Validation Accuracy | Validation Top-5 Accuracy | Validation Macro F1 | Validation Macro Precision | Validation Macro Recall | Test Loss | Test Accuracy | Test Top-5 Accuracy | Test Macro F1 | Test Macro Precision | Test Macro Recall |

|-----------|------------|------------|------------|----------------|----------------------|----------------|-------------------|-------------------------|-------------------|-------------------------|----------------------|-----------|---------------|-------------------|--------------|---------------------|------------------|

| c24c15b92a1149fa9fd1e7a787f1e5b2 | baseline | 10 | 0.0524 | 0.9867 | 0.9995 | 0.1061 | 0.9737 | 0.9958 | 0.9732 | 0.9792 | 0.9737 | - | - | - | - | - | - |
| b1ab602131634539868de6602f557373 | base-middle-frozen-low-dropout-HT-final| 10 | 0.0164 | 0.9960 | 0.9999 | 0.0902 | 0.9787 | 0.9981 | 0.9784 | 0.9828 | 0.9787 | 0.0464 | 0.9855 | 0.9996 | 0.9849 | 0.9882 | 0.9855 |

