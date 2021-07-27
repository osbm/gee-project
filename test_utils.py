from time import sleep
import unittest
from utils import *

testGeometry = [[28.366340126312252, 36.88169938417172],
          [28.257850136077877, 36.843243499704144],
          [28.33501296354565, 36.77328830688338],
          [28.432516625655026, 36.838162044065605]]


class RequestTests(unittest.TestCase):
    def setUp(self):
        self.testRequests = []
        
    def test_check_email_validity(self): 
        # add test case for invalid domains
         
        self.assertTrue(Request._check_email_validity("osmanfbayram@gmail.com"))
        self.assertTrue(Request._check_email_validity("sdssda@yahoo.com"))
        
        
        self.assertFalse(Request._check_email_validity(""))
        self.assertFalse(Request._check_email_validity("asasas"))
        self.assertFalse(Request._check_email_validity("sdşclsc@@@"))      
    
    def test_isupdated(self): 
        raise NotImplementedError
    
    def test_checkSatelliteUpdates(self): 
        raise NotImplementedError
    
    def test_get_mail_contents(self): 
        raise NotImplementedError
    
    def test_sendMail(self): 
        raise NotImplementedError
    
    def test_save(self): 
        raise NotImplementedError
