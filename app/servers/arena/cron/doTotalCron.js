const financial =  require("../../../dao/financialInquiriesDao"); 

module.exports = function(app) {
  return new Cron(app);
};

var Cron = function(app) {
  this.app = app;
  this.Config = app.get('config');
};

Cron.prototype.rank = async  function() {
    console.log("----------统计定时任务启动------------");
    financial.total_gameshist_day();
};

