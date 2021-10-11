def testSuccess = false

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
        script {
            testSuccess = 0 == sh(returnStatus: true, script: 'yarn test')
        }
      }
      post {
        always {
          script {
            def color = testSuccess ? "good" : "danger"
            slackSend(
              channel: "#protocol-duty",
              color: color,
              message: "\n *[e2e-tests] [${env.GIT_BRANCH}] Test Summary*: " + (testSuccess ? "SUCCESS" : "FAILED")
            )
          }
        }
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
