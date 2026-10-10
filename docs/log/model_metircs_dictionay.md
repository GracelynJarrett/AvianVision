# About this document
This document contains a dictionay for the models metrics. The dictionay explainse what each metric reusants and why it was recorder. At the end of the doc there is a table comparing the base model, chosie model and register model (chosin modle + test set).


# Metric Dictionay

## Loss
    ** Definition:
        Measueres how far the model's perdictions are from the true label.
    ** Why:
        Loss is the value optimized during traing with lower values the better the model is perfomaning. 

## Accuracy
    ** Definition:
        The proporion of predicitons that were classified correcly out of all predictions made
    ** Why: 
        Accuracy is one of the best metics to look at when decided to use the model or to contiue expermenting with hypertuning. 
    ** Formula:
                                Number of Correct Prdictions
                 Accuracy   =  -------------------------------
                                     Total Predictions


## Top-5 Accuracy
   ** Definition:
        Percentage of preidction wher ethe correct class appears within the models five highest-cofidenc predictions
    ** Why:
        Top 5 accuracy deminstys how closs the modle was to making the corrent prediction. 
    ** Formula:
                                true top 5 prediction class
            Top 5 Accuracy   =  -------------------------------
                                     Total Predictions


## Macro Precision
    ** Definition:
            Measures how often positive predictions are correct while giving equal importance to all classes
    ** Why:
        Macro allos the precision to be calulated independently for each class and then at the end averaged the class precision into one preciosn. 
    ** Formula:
                                    True Positives
            Precision   =  ----------------------------------
                            True Positives + Fasle Positves

## Macro Recall
    ** Definition:
            Measures the model's ability to identify all instances of each class
    ** Why:
            Macro calculateds each class independently and then averged them across all the classes
    ** Formula:
                                True Positives
            Recall  =  ----------------------------------
                        True Positives + Fasle Negatives

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
            Epochs that achieved the highest validation performance according to the selected evluation metric
    ** Why:
        Demistrats where the model preformed the best
        

## Prefix Definitions
   |Prefix|Definition|
   |train_|Metric calculated using the training dataset|
   |val_|Metric calculated using the validation dataset|
   |test_|Metric calculated using the test dataset|
   |final_|Metric calculated from the final training epoch|
   |best_|Metric corresponding to the epoch with the best validation performance|
   
        
        


# Metic Table
|Metric|Type|Definition|Better Direction|
|Loss|Optimization|Measuers prediction error used during training|Lower|
|Accuracy|Classification|Percentage of correctly classified samoles|Higher|
|Top-5 Accuracy|Classification|Percentage of samples where the true class is among the tip five predicted classes|Higher|
|Marco Precision|Classification|Average precision across all classes|Higher|
|Macro Recall|Classification|Average recall across all classes|Higher|
|Macro F1 Score|Classification|Harmonic mean of precision and recall averaged across classes|Higher|
|Best Epoch|Training|Epoch that achieved the best validation performance|N/A|





# Model table

|Model ID|Modle name|||||||||||||||||||||||||||||||||||||||
|||||||||||||||||||||||||||||||||||||||||||||
|
55947bdfa48e4b3daa329a3be608fde7
|base-middle-frozen-loq-dropout-HT|||||||||||||||||||||||||||||||||||||||||||