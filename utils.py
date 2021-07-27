import ee
import time
import hashlib

import constants
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import parseaddr

def lastImageDateonROI(satellite: str, ROI: ee.Geometry) -> int:
    """Return the last image date in a spesific ROI (region of interest). Returns date value as """
    imagery = ee.ImageCollection(satellite)
    image = imagery.filterBounds(ROI).sort("system:time_end", False).first()
    epochTime =  image.date().getInfo()["value"]
    return time.gmtime(epochTime/1000)
    



def readableDateFromEpoch(epochtime: int):
    theTime = time.gmtime(epochtime/1000)
    return time.strftime("%Y/%m/%d %H:%M:%S ",theTime)

class Request: # TODO Dont allow to produce a duplicate Request
    def __init__(self, geometry: list, deadline, clientName, clientMail):
        self.geometry = geometry

        if not isinstance(deadline, (timedelta, datetime)):
            self.deadline = timedelta(days=deadline)
        else:
            self.deadline = deadline
            
        self.clientName = clientName
        self.clientMail = clientMail
        
        self.mostRecentUpdate = ""

        self.lastSatelliteUpdates = {}
        self.checkSatelliteUpdates()

    def isUpdated(self) -> bool: 
        """Check if the satellites updated or not"""
        preUpdate = self.lastSatelliteUpdates
        self.checkSatelliteUpdates()
        for i in self.lastSatelliteUpdates:
            if self.lastSatelliteUpdates[i] != preUpdate[i]:
                self.mostRecentUpdate = i
                return True
        return False
    
    @classmethod     
    def _check_email_validity(cls, email) -> bool: # TODO
        return '@' in parseaddr(email)[1]
        

    def checkSatelliteUpdates(self):
        geo = ee.Geometry.Polygon(self.geometry)
        for satellite in constants.satelliteList:
            self.lastSatelliteUpdates[satellite] = lastImageDateonROI(satellite, geo)
            
    def _get_mail_contents(self):
        msg = EmailMessage()
        
        msg.set_content(f"""Merhabalar {self.clientName}, \n
                        <h1>Test</h1>""")
        
        msg["Subject"] = "The fire analysis report"
        msg["From"] = "fireanalysisreport@gmail.com"
        msg["To"] = self.clientMail
        
        return msg

    def sendMail(self):

        import smtplib, ssl

        port = 465  # For SSL
        smtp_server = "smtp.gmail.com"
        sender_email = "fireanalysisreport@gmail.com" 
        password = "2001osman"
        linkToProject = "https://osman.users.earthengine.app/view/prototype"
        
        
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
            server.login(sender_email, password)
            server.send_message(self._get_mail_contents())
            

        print("A mail has been sent to ", self.clientMail)

    def __hash__(self) -> int:
        """We are trying to hash this object just because we don't want to record duplitace objects."""
        h = hashlib.sha256()
        h.update(repr(self).encode())
        return int(h.hexdigest(), base=16) # a __hash__ method should return a integer value
        
    def __repr__(self) -> str:
        pointsTuple = tuple(list(map(tuple, self.geometry))) # turn nested lists into nested tuples
        return f"Request object\n Owner: '{self.clientName}'\n\tMail: '{self.clientMail}'\n\tDeadline: {self.deadline}\n\tGeometry: {pointsTuple}\n"
    
    def save(self, filename: str):
        with open(filename, "a") as file:
            file.write(repr(self))
    

def auth():
    """Authenticate the Earth Engine service account"""
    service_account = "gee-fire-project@appspot.gserviceaccount.com"
    credentials = ee.ServiceAccountCredentials(service_account, 'geefire-65005abbdad4.json')

    ee.Initialize(credentials)


def measureExecutionTime(func): # NOTE: this is a decorator, its kinda hard to explain
    """This is a decorator. Its very fun to use"""
    def inner():
        print("Program has started")
        start_time = time.time()
        func() # run the main program
        difference = round(time.time() - start_time, 2) # take the difference in time and round it up to 2 digits
        minutes, seconds = divmod(difference, 60) # now lets print the seconds as nice readable format
        hours, minutes = divmod(minutes, 60)
        print(f"Execution of this program lasted {hours} hours, {minutes} minutes and {seconds} seconds.")
    return inner




def readableDate(epochtime: int):
    theTime = time.gmtime(epochtime/1000)
    return time.strftime("%Y/%m/%d %H:%M:%S ",theTime)


def get_a_image(Satellite, geometry): 
    imagery =  ee.ImageCollection(Satellite) # specify satellite
    imagery = imagery.filterBounds(geometry) # filter by geometry
    image = imagery.sort("system:time_end", False).first()  # take the last image
    image = image.select(1,2,3) # select RGB bants
    return image 


def getAllRequests():
    # Resurrect all request objects from a savefile.
    ...