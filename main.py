import time
import ee
import utils
from utils import constants
import json
from pprint import pprint


@utils.measureExecutionTime # bu bir decorator, programın çalışma süresini yazdırmak için
def main():
    utils.auth()

    

    testRequest = utils.Request(
        constants.testGeometry,   # ROI
        100,                      # Update notification duration
        "Algernon",               # client name
        "osmanfbayram@gmail.com"  # client mail
    )
    testRequest.sendMail()
   
    counter = 0
    while True:
        break
        if testRequest.isUpdated():
            testRequest.sendMail()
            counter = 0
        counter += 1
        print(f"The Satellites has been checked {counter} times since last update.")
        time.sleep(3) # Tekrar tekrar deneme frenkansıyla oynamak için burayı değiştir.



if __name__ == "__main__":
    main()

