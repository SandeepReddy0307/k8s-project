import importlib.util,os,unittest
from unittest.mock import Mock,patch
os.environ.update(CATALOG_URL='http://catalog.test',REDIS_URL='redis://cache.test',REDIS_PASSWORD='unit-password')
spec=importlib.util.spec_from_file_location('recommendation','app/recommendation-service/src/app.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class RecommendationTests(unittest.TestCase):
 def setUp(self):self.client=module.app.test_client()
 def test_health(self):self.assertEqual(self.client.get('/health').status_code,200)
 def test_ready_reports_failure(self):
  with patch.object(module.r,'ping',side_effect=module.redis.RedisError()):self.assertEqual(self.client.get('/ready').status_code,503)
 def test_cached_results_preserve_structured_catalog(self):
  with patch.object(module.r,'get',return_value='[{"id":1,"name":"Sample"}]'):
   response=self.client.get('/recommendations/viewer');self.assertEqual(response.json['source'],'cache');self.assertEqual(response.json['titles'][0]['id'],1)
 def test_dependency_failure_never_invents_recommendations(self):
  with patch.object(module.r,'get',side_effect=module.redis.RedisError()):
   response=self.client.get('/recommendations/viewer');self.assertEqual(response.status_code,503);self.assertNotIn('titles',response.json)
if __name__=='__main__':unittest.main()
