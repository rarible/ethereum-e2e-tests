pipeline {
  agent none
  options {
    disableConcurrentBuilds()
  }
  stages {
    stage('test') {
      environment {
	      NPM_TOKEN = "na"
      }
      agent any
      steps {
				sh 'yarn'
				sh 'yarn bootstrap'
				sh 'yarn clean'
				sh 'yarn build-all'
				sh 'yarn test'
      }
    }
  }
  post {
    always {
      node("") {
        cleanWs()
      }
    }
  }
}
