class CustomError extends Error{
    constructor(message){
        super(message)
    }
}
class NewError extends CustomError{
    constructor(meessage){
        super("message")
    }
}
try {
    throw new Error("In new errror")
    
} catch (error) {
    if (error instanceof NewError) {
        console.log(error.message)
    } else {
        console.log("false")
    }
}
